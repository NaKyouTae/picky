//
//  WebView.swift
//  Picky
//

import Photos
import SwiftUI
import UIKit
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    let onLoad: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onLoad: onLoad)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences

        // 콜라주 저장 — WKWebView 는 <a download> 를 무시하므로 웹이 PNG 를 넘겨주고
        // 네이티브가 사진 앱에 담는다. (app/src/components/collage-maker.tsx)
        configuration.userContentController.add(context.coordinator, name: "saveImage")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.bounces = false
        webView.isOpaque = false
        // 웹이 그려지기 전 한 프레임 동안 보이는 바탕. 메인 화면과 같은 night 로 둔다.
        webView.backgroundColor = UIColor(Color.pickyNight)

        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false

        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let onLoad: () -> Void
        private var hasNotifiedLoad = false

        init(onLoad: @escaping () -> Void) {
            self.onLoad = onLoad
            super.init()
        }

        // MARK: - WKScriptMessageHandler

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "saveImage", let webView = message.webView else { return }

            guard let body = message.body as? [String: Any],
                  let dataUrl = body["dataUrl"] as? String,
                  let image = Self.image(fromDataUrl: dataUrl) else {
                Self.reportSaveResult(ok: false, reason: "failed", to: webView)
                return
            }

            save(image, from: webView)
        }

        /// data:image/...;base64,... 를 UIImage 로.
        private static func image(fromDataUrl dataUrl: String) -> UIImage? {
            guard let comma = dataUrl.firstIndex(of: ","),
                  dataUrl.hasPrefix("data:image/") else { return nil }
            let base64 = String(dataUrl[dataUrl.index(after: comma)...])
            guard let data = Data(base64Encoded: base64) else { return nil }
            return UIImage(data: data)
        }

        /// 사진 앱에 담는다. 권한은 추가 전용(addOnly)만 요청한다 —
        /// 앨범을 읽을 일이 없으므로 전체 접근을 물으면 사용자가 거절할 이유만 늘어난다.
        ///
        /// 완료 핸들러 대신 async 를 쓰는 이유: Photos 의 콜백은 백그라운드 큐로 오는데
        /// 결과 통지(evaluateJavaScript)는 메인에서 해야 한다. Task 는 이 메서드의
        /// MainActor 격리를 이어받으므로 큐를 직접 넘나들 일이 없다.
        private func save(_ image: UIImage, from webView: WKWebView) {
            Task {
                let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
                guard status == .authorized || status == .limited else {
                    Self.reportSaveResult(ok: false, reason: "denied", to: webView)
                    return
                }

                do {
                    try await PHPhotoLibrary.shared().performChanges {
                        _ = PHAssetChangeRequest.creationRequestForAsset(from: image)
                    }
                    Self.reportSaveResult(ok: true, reason: nil, to: webView)
                } catch {
                    Self.reportSaveResult(ok: false, reason: "failed", to: webView)
                }
            }
        }

        /// 저장 결과를 웹에 알린다. 웹은 이 이벤트로 안내 문구를 띄운다.
        /// reason 은 코드가 정한 고정 문자열이라 따로 이스케이프하지 않는다.
        private static func reportSaveResult(ok: Bool, reason: String?, to webView: WKWebView) {
            let detail = ok ? "{ok:true}" : "{ok:false,reason:'\(reason ?? "failed")'}"
            webView.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('picky:save-image-result',{detail:\(detail)}))"
            )
        }

        // MARK: - WKNavigationDelegate

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            // HTML 응답이 도착해 렌더링이 시작되는 시점에 스플래시를 걷는다.
            // didFinish(전체 로드 완료)를 기다리면 JS 번들·데이터까지 끝나야 해서 훨씬 늦다.
            // 이 시점엔 SSR HTML 이 이미 그려지고, 웹의 native-splash 가 같은 그림을
            // 이어받으므로 끊김 없이 넘어간다.
            // Next.js SPA 내비게이션에서 다시 불릴 수 있어 한 번만 통지한다.
            guard !hasNotifiedLoad else { return }
            hasNotifiedLoad = true
            onLoad()
        }

        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url,
               let scheme = url.scheme,
               !scheme.hasPrefix("http"), scheme != "about", scheme != "blob" {
                // 카카오톡·카드사 앱카드 등 커스텀 URL 스킴은 외부 앱으로 연다.
                openExternalApp(url, from: webView)
                decisionHandler(.cancel)
                return
            }

            // http(s) 내비게이션은 모두 WebView 안에서 처리한다.
            // 결제·로그인 페이지의 <a> 기반 버튼까지 사파리로 넘기면 세션이 끊긴다.
            // 새 창(target="_blank")으로 여는 외부 링크는 createWebViewWith 에서 가른다.
            decisionHandler(.allow)
        }

        /// 외부 앱 스킴을 연다. 앱이 없으면 WebView 안에서 사용자에게 알린다.
        /// canOpenURL 을 쓰지 않는 이유: Info.plist 의 LSApplicationQueriesSchemes 에
        /// 등록한 스킴만 true 를 주는데, 카드사 앱 스킴은 카드사마다 다르고 수시로 바뀐다.
        private func openExternalApp(_ url: URL, from webView: WKWebView) {
            UIApplication.shared.open(url, options: [:]) { [weak webView] success in
                guard !success, let webView else { return }
                let message = "결제에 필요한 앱이 설치되어 있지 않습니다. "
                    + "앱스토어에서 설치한 뒤 다시 시도해 주세요."
                let escaped = message.replacingOccurrences(of: "'", with: "\\'")
                webView.evaluateJavaScript("alert('\(escaped)')")
            }
        }

        // MARK: - WKUIDelegate (popup / window.open)

        /// 토스페이먼츠 결제창과 카드사 인증 페이지는 window.open 으로 창을 띄운다.
        /// 이 델리게이트가 없으면 WKWebView 가 그 내비게이션을 조용히 버려서
        /// 결제 화면이 아예 뜨지 않는다.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard let url = navigationAction.request.url else { return nil }

            if let scheme = url.scheme,
               !scheme.hasPrefix("http"), scheme != "about", scheme != "blob" {
                openExternalApp(url, from: webView)
                return nil
            }

            if let host = url.host, !Self.isOurHost(host),
               navigationAction.navigationType == .linkActivated {
                // 서비스 바깥 사이트를 새 창으로 여는 링크는 사파리로 넘긴다.
                UIApplication.shared.open(url)
                return nil
            }

            // 그 외 새 창 요청(결제·인증 팝업 포함)은 현재 WebView 에서 이어서 연다.
            webView.load(navigationAction.request)
            return nil
        }

        /// 우리 서비스의 호스트인지.
        ///
        /// `contains` 가 아니라 정확히 일치하거나 하위 도메인인지를 본다 —
        /// `contains` 는 `spectrify.kr.example.com` 같은 남의 주소도 우리 것으로 읽는다.
        /// 디버그 빌드에서 로컬 개발 서버를 띄웠을 때를 위해 실제로 로드한 호스트도 함께 친다.
        private static func isOurHost(_ host: String) -> Bool {
            if host == "spectrify.kr" || host.hasSuffix(".spectrify.kr") { return true }
            return host == AppConfig.webURL.host
        }

        /// 팝업이 window.close() 를 부르면 원래 화면으로 되돌린다.
        /// createWebViewWith 에서 같은 WebView 에 실었으므로 닫기 = 뒤로 가기다.
        func webViewDidClose(_ webView: WKWebView) {
            if webView.canGoBack {
                webView.goBack()
            }
        }

        // MARK: - WKUIDelegate (camera)

        /// 챌린지 인증 사진은 <input type="file" capture="environment"> 로 찍는다.
        func webView(_ webView: WKWebView,
                     requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                     initiatedByFrame frame: WKFrameInfo,
                     type: WKMediaCaptureType,
                     decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
    }
}
