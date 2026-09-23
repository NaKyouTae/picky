//
//  AdBridge.swift
//  Picky
//

import AppTrackingTransparency
import GoogleMobileAds
import UIKit
import UserMessagingPlatform
import WebKit

/// 웹이 요청하는 AdMob 보상형 광고를 띄운다.
///
/// **왜 네이티브가 맡는가.** AdMob 은 앱 광고를 Google Mobile Ads SDK 로만 서빙하게 한다 —
/// WebView 안에 광고 태그를 심는 것은 정책 위반(무효 트래픽)이라 계정 정지 사유다.
/// 그래서 IapBridge 와 같은 모양이 된다: **네이티브가 맡는 것은 광고 재생뿐이고**,
/// 보상(다시 뽑기)을 주는 일은 그대로 웹·서버의 몫이다.
/// (웹: app/src/lib/native-app.ts · 화면: app/src/components/challenge-group-screen.tsx)
///
/// ## 보상은 언제 주는가
///
/// `userDidEarnReward` 가 불린 뒤에만 `{ok:true}` 를 돌려준다. 사용자가 광고를 중간에
/// 닫으면 `cancelled` 이고 웹은 다시 뽑기를 진행하지 않는다 — AdMob 보상형 정책이
/// 요구하는 '끝까지 본 사람에게만 보상' 이다.
///
/// ## 동의 순서
///
/// UMP(동의 양식) → ATT(추적 허용) → SDK 시작 순서를 지킨다. ATT 를 먼저 띄우면
/// 구글이 권고하는 순서를 어기게 되고, 동의 전에 광고를 요청하면 EEA 사용자에게
/// 맞춤 광고가 나갈 수 있다.
@MainActor
final class AdBridge: NSObject, FullScreenContentDelegate {
    /// WKWebView 에 등록하는 메시지 핸들러 이름. 웹은 이 핸들러의 존재로 광고 가능 여부를 가른다.
    static let handlerName = "ads"

    private static let resultEvent = "picky:ad-result"

    /// 미리 받아 둔 광고. 한 번 띄운 광고는 재사용할 수 없어 쓰는 즉시 비운다.
    private var loaded: RewardedAd?

    /// 동의 확인 + SDK 시작. 여러 번 불려도 한 번만 돈다.
    private var preparation: Task<Void, Never>?

    /// 미리 받기가 겹치지 않도록 들고 있는 요청. 같은 광고를 두 번 받아 봐야 소용없다.
    private var loading: Task<RewardedAd?, Never>?

    /// 광고가 닫히기를 기다리는 쪽. 보상 여부를 담아 깨운다.
    private var presenting: CheckedContinuation<Bool, Never>?

    /// 이번에 띄운 광고에서 보상 조건을 채웠는지 — 닫힘 콜백에서 함께 읽는다.
    private var earned = false

    /// WKWebView 의 Coordinator 가 메인 액터 밖에서 만들기 때문에 생성만 격리를 벗어난다.
    nonisolated override init() {
        super.init()
    }

    /// 웹이 보낸 요청을 받는다. 답은 항상 같은 requestId 를 달아 이벤트로 돌려준다.
    func handle(_ body: Any, from webView: WKWebView) {
        guard let message = body as? [String: Any],
              let requestId = message["requestId"] as? String,
              let action = message["action"] as? String else { return }

        Task {
            switch action {
            case "prepare":
                // 화면에 들어올 때 미리 받아 둔다 — 버튼을 누른 뒤에 받기 시작하면
                // 광고가 뜨기까지 몇 초를 빈 화면으로 기다리게 된다.
                await prepare(from: webView)
                await preload()
                reply(["ok": loaded != nil], requestId: requestId, to: webView)
            case "show":
                await show(requestId: requestId, to: webView)
            default:
                reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
            }
        }
    }

    // MARK: - 광고 띄우기

    private func show(requestId: String, to webView: WKWebView) async {
        await prepare(from: webView)

        guard let ad = await preload(), let root = Self.rootViewController(for: webView) else {
            // 재고가 없거나(노필) 아직 못 받았다. 웹은 안내만 하고 다시 뽑기를 진행하지 않는다.
            reply(["ok": false, "reason": "unavailable"], requestId: requestId, to: webView)
            return
        }

        // 띄운 광고는 다시 쓸 수 없다. 여기서 비워야 실패하더라도 같은 광고를 또 띄우지 않는다.
        loaded = nil

        let rewarded = await present(ad, from: root)

        // 다음 다시 뽑기를 위해 미리 받아 둔다 (결과를 기다리지 않는다).
        Task { await preload() }

        reply(rewarded ? ["ok": true] : ["ok": false, "reason": "cancelled"],
              requestId: requestId, to: webView)
    }

    /// 광고를 띄우고 닫힐 때까지 기다린다. 돌려주는 값은 '보상 조건을 채웠는가' 다.
    ///
    /// 보상 콜백(`userDidEarnRewardHandler`)은 광고가 닫히기 **전에** 불린다. 그래서 플래그로
    /// 받아 두었다가 닫힘 콜백에서 함께 읽는다 — 보상만 보고 바로 답하면 광고가 아직 화면을
    /// 덮고 있는 동안 다시 뽑기 화면이 돌아가 버린다.
    private func present(_ ad: RewardedAd, from root: UIViewController) async -> Bool {
        earned = false
        ad.fullScreenContentDelegate = self

        return await withCheckedContinuation { continuation in
            presenting = continuation
            ad.present(from: root) { [weak self] in
                self?.earned = true
            }
        }
    }

    /// 기다리던 쪽을 깨운다. 실패와 닫힘이 겹쳐 두 번 불려도 한 번만 재개해야 한다.
    private func finishPresenting(rewarded: Bool) {
        presenting?.resume(returning: rewarded)
        presenting = nil
    }

    // MARK: - FullScreenContentDelegate

    func ad(_ ad: FullScreenPresentingAd,
            didFailToPresentFullScreenContentWithError error: Error) {
        finishPresenting(rewarded: false)
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        finishPresenting(rewarded: earned)
    }

    // MARK: - 미리 받기

    /// 광고를 하나 확보한다. 이미 들고 있으면 그것을 그대로 쓴다.
    @discardableResult
    private func preload() async -> RewardedAd? {
        if let loaded { return loaded }
        if let loading { return await loading.value }

        // 동의를 받지 못한 상태에서 요청하면 광고가 오지 않는다 — 요청 자체를 하지 않는다.
        guard ConsentInformation.shared.canRequestAds else { return nil }

        let task = Task { () -> RewardedAd? in
            try? await RewardedAd.load(with: AppConfig.rewardedAdUnitID, request: Request())
        }
        loading = task

        let ad = await task.value
        loading = nil
        loaded = ad
        return ad
    }

    // MARK: - 동의 · SDK 시작

    /// 동의를 받고 SDK 를 켠다. 앱이 살아 있는 동안 한 번만 돈다.
    private func prepare(from webView: WKWebView) async {
        if let preparation {
            await preparation.value
            return
        }

        let task = Task { [weak self] in
            await self?.requestConsent(from: webView)
            await Self.requestTracking()
            await MobileAds.shared.start()
        }
        preparation = task
        await task.value
    }

    /// UMP 동의 양식. 한국만 겨냥한 서비스라도 EEA 에서 열 수 있어 거쳐 둔다.
    ///
    /// 실패해도 넘어간다 — 동의를 못 받으면 `canRequestAds` 가 false 라 광고를 요청하지
    /// 않게 되고, 그때는 다시 뽑기가 '광고를 불러올 수 없다' 로 끝난다.
    private func requestConsent(from webView: WKWebView) async {
        await withCheckedContinuation { continuation in
            ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { _ in
                continuation.resume()
            }
        }

        guard let root = Self.rootViewController(for: webView) else { return }
        try? await ConsentForm.loadAndPresentIfRequired(from: root)
    }

    /// ATT 추적 허용. 아직 묻지 않았을 때만 띄운다 —
    /// 거부한 사용자에게 다시 물어도 시스템이 바로 거부로 답한다.
    private static func requestTracking() async {
        guard ATTrackingManager.trackingAuthorizationStatus == .notDetermined else { return }
        _ = await ATTrackingManager.requestTrackingAuthorization()
    }

    // MARK: - 응답

    /// 광고를 띄울 화면. WebView 가 이미 창에 올라와 있으므로 그 창의 루트를 쓴다.
    private static func rootViewController(for webView: WKWebView) -> UIViewController? {
        webView.window?.rootViewController
    }

    /// 결과를 웹에 이벤트로 알린다. (IapBridge 와 같은 방식 — 값은 JSON 으로 직렬화한다)
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
