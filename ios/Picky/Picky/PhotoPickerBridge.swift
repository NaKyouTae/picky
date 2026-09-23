//
//  PhotoPickerBridge.swift
//  Picky
//

import PhotosUI
import UIKit
import WebKit

/// 웹의 '사진 보관함' 버튼이 사진첩을 곧바로 열도록 네이티브 피커를 띄운다.
///
/// **왜 네이티브가 맡는가.** WKWebView 에서 `<input type="file" accept="image/*">` 를 열면
/// iOS 가 '사진 보관함 · 사진 찍기 · 파일 선택' 세 갈래 액션시트를 한 번 더 끼워 넣는다.
/// 우리 바텀시트(app/src/components/challenge-photo-sheet.tsx)에서 이미 고른 뒤라
/// 같은 질문을 두 번 받는 꼴이 된다. 웹 표준으로는 이 시트를 건너뛸 방법이 없어서,
/// 앱에서만 PHPicker 를 직접 띄우고 고른 사진을 웹으로 넘긴다.
/// (웹: app/src/lib/native-app.ts · 화면: app/src/components/challenge-group-screen.tsx)
///
/// 사진 찍기는 그대로 `capture="environment"` 인 input 이 맡는다 — 그 경우 iOS 가
/// 시트 없이 카메라를 바로 열어 주므로 네이티브가 끼어들 이유가 없다.
///
/// ## 권한
///
/// PHPicker 는 앱과 분리된 프로세스에서 돌아 사진첩 접근 권한을 묻지 않는다.
/// 사용자가 고른 한 장만 앱으로 건네받는다.
@MainActor
final class PhotoPickerBridge: NSObject, PHPickerViewControllerDelegate {
    /// WKWebView 에 등록하는 메시지 핸들러 이름. 웹은 이 핸들러의 존재로 사용 가능 여부를 가른다.
    static let handlerName = "photos"

    private static let resultEvent = "picky:photo-result"

    /// 넘기기 전에 줄이는 크기 — 웹의 compressImage 와 같은 값이다
    /// (app/src/lib/compress-image.ts). 원본 그대로 base64 로 실어 보내면
    /// 한 장에 수 MB 짜리 문자열이 되어 WebView 로 넘기는 것부터 느려진다.
    private static let maxEdge: CGFloat = 1600
    private static let jpegQuality: CGFloat = 0.8

    /// 사진을 고르기를 기다리는 요청. 피커는 한 번에 하나만 띄운다.
    private var pending: (requestId: String, webView: WKWebView)?

    /// WKWebView 의 Coordinator 가 메인 액터 밖에서 만들기 때문에 생성만 격리를 벗어난다.
    nonisolated override init() {
        super.init()
    }

    /// 웹이 보낸 요청을 받는다. 답은 항상 같은 requestId 를 달아 이벤트로 돌려준다.
    func handle(_ body: Any, from webView: WKWebView) {
        guard let message = body as? [String: Any],
              let requestId = message["requestId"] as? String,
              let action = message["action"] as? String else { return }

        switch action {
        case "pick":
            present(requestId: requestId, from: webView)
        default:
            reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
        }
    }

    // MARK: - 피커 띄우기

    private func present(requestId: String, from webView: WKWebView) {
        // 이미 떠 있으면 새로 띄우지 않는다 — 앞선 요청의 답이 먼저 나가야 한다.
        guard pending == nil, let root = webView.window?.rootViewController else {
            reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
            return
        }

        var configuration = PHPickerConfiguration()
        configuration.filter = .images
        configuration.selectionLimit = 1

        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self

        pending = (requestId, webView)
        root.present(picker, animated: true)
    }

    // MARK: - PHPickerViewControllerDelegate

    /// 고르거나 취소하면 불린다 — 취소는 results 가 빈 배열이다.
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard let (requestId, webView) = pending else { return }
        pending = nil

        guard let provider = results.first?.itemProvider else {
            reply(["ok": false, "reason": "cancelled"], requestId: requestId, to: webView)
            return
        }

        Task {
            guard let dataUrl = await Self.jpegDataUrl(from: provider) else {
                reply(["ok": false, "reason": "failed"], requestId: requestId, to: webView)
                return
            }
            reply(["ok": true, "dataUrl": dataUrl], requestId: requestId, to: webView)
        }
    }

    // MARK: - 이미지 변환

    /// 고른 사진을 줄여 data URL 로 만든다. 읽지 못하면 nil 이다.
    private static func jpegDataUrl(from provider: NSItemProvider) async -> String? {
        guard let image = await loadImage(from: provider),
              let data = downscaled(image).jpegData(compressionQuality: jpegQuality) else {
            return nil
        }
        return "data:image/jpeg;base64,\(data.base64EncodedString())"
    }

    /// PHPicker 가 준 항목을 UIImage 로 읽는다. 콜백이 백그라운드 큐로 와서 async 로 감싼다.
    private static func loadImage(from provider: NSItemProvider) async -> UIImage? {
        guard provider.canLoadObject(ofClass: UIImage.self) else { return nil }

        return await withCheckedContinuation { continuation in
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                continuation.resume(returning: object as? UIImage)
            }
        }
    }

    /// 긴 변을 maxEdge 에 맞춰 줄인다. 이미 작으면 그대로 둔다.
    private static func downscaled(_ image: UIImage) -> UIImage {
        let longest = max(image.size.width, image.size.height)
        guard longest > maxEdge else { return image }

        let scale = maxEdge / longest
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)

        // scale 1 로 그려 화면 배율이 픽셀 수를 다시 부풀리지 않게 한다.
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1

        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    // MARK: - 응답

    /// 결과를 웹에 이벤트로 알린다. (IapBridge·AdBridge 와 같은 방식 — 값은 JSON 으로 직렬화한다)
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
