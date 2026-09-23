//
//  IapBridge.swift
//  Picky
//

import Foundation
import StoreKit
import WebKit

/// 웹이 요청하는 App Store 인앱결제를 처리한다.
///
/// 앱 안에서 열리는 유료 템플릿은 외부 결제로 팔 수 없어(App Review Guideline 3.1.1)
/// iOS 앱에서는 토스 결제창 대신 StoreKit 을 쓴다. 다만 **네이티브가 맡는 것은 결제뿐이다** —
/// 화면과 이용 기간 적립은 그대로 웹·서버의 몫이라, 여기서는 영수증을 꺼내 웹에 넘기기만 한다.
/// (웹: app/src/lib/native-app.ts)
///
/// ## 거래를 언제 finish 하는가
///
/// **서버 적립이 끝난 뒤에 한다.** 먼저 finish 하면 적립 요청이 실패했을 때 영수증을 다시 얻을
/// 방법이 없어 돈만 빠져나간 상태가 된다. finish 하지 않은 거래는 StoreKit 이 계속 들고 있으므로
/// `restore` 로 다시 꺼내 적립할 수 있다 — 서버는 같은 영수증을 여러 번 받아도 한 번만 적립한다.
@MainActor
final class IapBridge {
    /// WKWebView 에 등록하는 메시지 핸들러 이름. 웹은 이 핸들러의 존재로 결제 가능 여부를 가른다.
    static let handlerName = "iap"

    private static let resultEvent = "picky:iap-result"

    /// 아직 finish 하지 않은 거래 — 키는 웹에 알려 준 transactionId 다
    private var unfinished: [String: VerificationResult<Transaction>] = [:]

    /// 가족 승인(Ask to Buy)처럼 결제창을 닫은 뒤에 확정되는 거래를 받는다.
    /// 앱이 살아 있는 동안 계속 돌아야 하므로 따로 취소하지 않는다.
    private var updatesTask: Task<Void, Never>?

    /// WKWebView 의 Coordinator 가 메인 액터 밖에서 만들기 때문에 생성만 격리를 벗어난다.
    /// (담는 값은 빈 상태뿐이라 실제로 건드릴 공유 상태가 없다)
    nonisolated init() {}

    /// 가족 승인 감시를 시작한다. 요청이 올 때마다 불러도 한 번만 돈다.
    private func start() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let transaction) = update else { continue }
                self?.unfinished[String(transaction.id)] = update
            }
        }
    }

    /// 웹이 보낸 요청을 받는다. 답은 항상 같은 requestId 를 달아 이벤트로 돌려준다.
    func handle(_ body: Any, from webView: WKWebView) {
        guard let message = body as? [String: Any],
              let requestId = message["requestId"] as? String,
              let action = message["action"] as? String else { return }

        // 첫 요청 때 감시를 켠다. 그 전에 확정된 거래도 `restore` 가 StoreKit 에서 직접
        // 읽어 오므로(Transaction.unfinished) 놓치지 않는다.
        start()

        Task {
            switch action {
            case "products":
                await sendProducts(message["productIds"] as? [String] ?? [],
                                   requestId: requestId, to: webView)
            case "purchase":
                await buy(message["productId"] as? String, requestId: requestId, to: webView)
            case "restore":
                await sendUnfinished(requestId: requestId, to: webView)
            case "finish":
                await finish(message["transactionId"] as? String,
                             requestId: requestId, to: webView)
            default:
                reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
            }
        }
    }

    // MARK: - 상품

    /// 가격은 스토어가 현지화한 문구(`displayPrice`)를 그대로 넘긴다 —
    /// 실제로 청구되는 값이라 우리 DB 가격보다 이쪽이 맞다.
    private func sendProducts(_ ids: [String], requestId: String, to webView: WKWebView) async {
        guard !ids.isEmpty else {
            reply(["products": []], requestId: requestId, to: webView)
            return
        }

        let products = (try? await Product.products(for: ids)) ?? []
        let payload = products.map { ["productId": $0.id, "displayPrice": $0.displayPrice] }
        reply(["products": payload], requestId: requestId, to: webView)
    }

    // MARK: - 결제

    private func buy(_ productId: String?, requestId: String, to webView: WKWebView) async {
        guard let productId else {
            reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
            return
        }

        // 상품을 못 찾는 경우가 실제로 많다 — App Store Connect 등록 직후이거나,
        // 계약(유료 앱 계약)이 아직 활성화되지 않았을 때다.
        let products = (try? await Product.products(for: [productId])) ?? []
        guard let product = products.first else {
            reply(["ok": false, "reason": "unavailable"], requestId: requestId, to: webView)
            return
        }

        do {
            switch try await product.purchase() {
            case .success(let verification):
                send(verification, requestId: requestId, to: webView)
            case .pending:
                // 가족 승인 대기 등 — 승인되면 Transaction.updates 로 들어온다.
                reply(["ok": false, "reason": "pending"], requestId: requestId, to: webView)
            case .userCancelled:
                reply(["ok": false, "reason": "cancelled"], requestId: requestId, to: webView)
            @unknown default:
                reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
            }
        } catch {
            reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
        }
    }

    /// 검증을 통과한 거래만 웹에 넘긴다.
    ///
    /// `unverified` 는 StoreKit 이 서명을 확인하지 못한 경우다. 서버가 어차피 한 번 더
    /// 검증하지만, 여기서 걸러 내면 쓸모없는 왕복을 줄일 수 있다.
    private func send(_ verification: VerificationResult<Transaction>,
                      requestId: String,
                      to webView: WKWebView) {
        guard case .verified(let transaction) = verification else {
            reply(["ok": false, "reason": "unverified"], requestId: requestId, to: webView)
            return
        }

        let id = String(transaction.id)
        // 서버 적립이 끝나고 웹이 finish 를 부를 때까지 들고 있는다.
        unfinished[id] = verification

        reply([
            "ok": true,
            "transactionId": id,
            "signedTransactionInfo": verification.jwsRepresentation,
        ], requestId: requestId, to: webView)
    }

    // MARK: - 미적립 거래 복구

    /// 아직 적립되지 않은 영수증을 모두 돌려준다.
    ///
    /// 적립 요청이 실패했거나 그 사이 앱이 꺼진 경우에 쓴다. 앱을 다시 켜면 메모리 목록이
    /// 비어 있으므로 StoreKit 에서 직접 읽어 채운다.
    private func sendUnfinished(requestId: String, to webView: WKWebView) async {
        for await result in Transaction.unfinished {
            guard case .verified(let transaction) = result else { continue }
            unfinished[String(transaction.id)] = result
        }

        let payload = unfinished.map { id, result in
            ["transactionId": id, "signedTransactionInfo": result.jwsRepresentation]
        }
        reply(["receipts": payload], requestId: requestId, to: webView)
    }

    /// 적립이 끝난 거래를 닫는다. 이 시점 이후로는 StoreKit 이 다시 알려 주지 않는다.
    private func finish(_ transactionId: String?,
                        requestId: String,
                        to webView: WKWebView) async {
        guard let transactionId,
              let result = unfinished[transactionId],
              case .verified(let transaction) = result else {
            reply(["ok": false], requestId: requestId, to: webView)
            return
        }

        await transaction.finish()
        unfinished[transactionId] = nil
        reply(["ok": true], requestId: requestId, to: webView)
    }

    // MARK: - 응답

    /// 결과를 웹에 이벤트로 알린다.
    ///
    /// 값에 따옴표·백슬래시가 섞일 수 있어 직접 문자열을 짜지 않고 JSON 으로 직렬화한다
    /// (JSON 은 JS 리터럴로 그대로 쓸 수 있다).
    private func reply(_ payload: [String: Any], requestId: String, to webView: WKWebView) {
        var detail = payload
        detail["requestId"] = requestId

        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else { return }

        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('\(Self.resultEvent)',{detail:\(json)}))"
        )
    }
}
