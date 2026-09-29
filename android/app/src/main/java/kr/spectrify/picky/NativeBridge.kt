package kr.spectrify.picky

import android.util.Log
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * 웹이 부르는 네이티브 기능의 창구.
 *
 * ## 왜 `webkit.messageHandlers` 인가
 *
 * 웹(app/src/lib/native-app.ts)은 iOS 의 `window.webkit.messageHandlers.<이름>.postMessage(...)`
 * 로 네이티브를 부르고, **그 핸들러가 있는지로 앱 여부와 기능 가용성을 가른다.**
 * 안드로이드의 `addJavascriptInterface` 는 `window.<이름>.<메서드>()` 라 모양이 다르다.
 *
 * 그래서 **문서가 뜨기 전에 shim 을 심어 같은 모양을 만들어 준다**([SHIM]).
 * 웹을 한 줄도 고치지 않고 양쪽이 같은 규약을 쓰게 된다. `webkit` 이라는 iOS 티가 나는 이름이
 * 안드로이드에 남지만, 이름을 바꾸려면 웹·iOS 를 같이 고쳐야 하므로 양쪽이 다 도는 것을
 * 확인한 뒤에 할 일이다.
 *
 * ## 무엇을 노출하는가
 *
 * **shim 에 올린 핸들러만 노출된다 — 그게 곧 기능 스위치다.** 아직 구현하지 않은 것은 올리지
 * 않으면 웹이 알아서 그 기능 없이 동작한다.
 *
 * | 핸들러      | 지금   | 메모                                                          |
 * | ----------- | ------ | ------------------------------------------------------------- |
 * | `saveImage` | 노출   | 콜라주 저장. **웹은 이 핸들러의 존재로 앱인지 판별한다**        |
 * | `photos`    | 안 함  | 안드로이드는 `<input type=file>` 이 이미 사진 선택기를 바로 연다 |
 * | `iap`       | 노출   | Google Play Billing (IapBridge.kt)                            |
 * | `ads`       | 안 함  | AdMob (Phase 5)                                               |
 *
 * ⚠️ **`saveImage` 를 노출하면 웹의 `isNativeApp()` 이 true 가 된다.** 그러면 결제 화면이
 * 인앱결제 분기를 타므로, 웹에도 플랫폼 분기가 함께 있어야 한다
 * (app/src/lib/native-app.ts 의 `nativePlatform`).
 */
class NativeBridge(
    private val webView: PickyWebView,
    private val imageSaver: ImageSaver,
    private val iap: IapBridge,
) {
    init {
        imageSaver.onResult = ::reportSaveResult
    }

    /**
     * shim 이 부르는 단일 진입점.
     *
     * ⚠️ **메인 스레드가 아니다.** WebView 는 이 메서드를 전용 JavaBridge 스레드에서 부른다.
     * `evaluateJavascript` 나 뷰를 건드리는 일은 반드시 메인으로 넘겨야 한다.
     */
    @JavascriptInterface
    fun postMessage(handler: String, body: String) {
        val message = try {
            JSONObject(body)
        } catch (e: Exception) {
            Log.w(TAG, "$handler: 본문을 읽지 못했다")
            return
        }

        when (handler) {
            "saveImage" -> {
                val dataUrl = message.optString("dataUrl")
                if (dataUrl.isEmpty()) reportSaveResult(ImageSaver.Result.FAILED)
                else imageSaver.save(dataUrl)
            }
            IapBridge.HANDLER_NAME -> iap.handle(message)
            else -> Log.w(TAG, "모르는 핸들러: $handler")
        }
    }

    /**
     * 저장 결과를 웹에 알린다 — iOS 와 **같은 이벤트 이름**이어야 한다.
     *
     * `saveImage` 는 다른 브리지와 달리 requestId 를 쓰지 않는다 (웹이 한 번에 한 장만 저장한다).
     * reason 은 코드가 정한 고정 문자열이라 따로 이스케이프하지 않는다.
     */
    private fun reportSaveResult(result: ImageSaver.Result) {
        val detail = JSONObject().put("ok", result == ImageSaver.Result.OK)
        if (result != ImageSaver.Result.OK) {
            detail.put("reason", if (result == ImageSaver.Result.DENIED) "denied" else "failed")
        }
        webView.dispatchEvent(SAVE_IMAGE_EVENT, detail.toString())
    }

    companion object {
        private const val TAG = "PickyNativeBridge"
        private const val SAVE_IMAGE_EVENT = "picky:save-image-result"

        /** `addJavascriptInterface` 로 심는 객체 이름. shim 안에서만 쓴다. */
        const val INTERFACE_NAME = "PickyNativeBridge"

        /**
         * 문서의 스크립트보다 먼저 도는 shim.
         *
         * 웹은 `isNativeApp()` 을 한 번만 읽고 구독하지 않으므로
         * (native-app.ts 의 `subscribe` 가 빈 함수다), **첫 스크립트가 돌기 전에** 심어야 한다.
         * `addDocumentStartJavaScript` 가 그 자리를 보장한다.
         *
         * `PickyNative.platform` 은 웹이 iOS 와 안드로이드를 가르는 표식이다 — 결제처럼
         * 플랫폼마다 규칙이 다른 화면이 이 값을 본다.
         */
        val SHIM = """
            (function () {
              if (window.PickyNative) return;

              function handler(name) {
                return {
                  postMessage: function (body) {
                    try {
                      $INTERFACE_NAME.postMessage(name, JSON.stringify(body));
                    } catch (e) {
                      console.error('native bridge failed: ' + name, e);
                    }
                  }
                };
              }

              window.webkit = window.webkit || {};
              window.webkit.messageHandlers = window.webkit.messageHandlers || {};
              // 여기 올린 것만 웹에 노출된다 (위 표 참고).
              window.webkit.messageHandlers.saveImage = handler('saveImage');
              window.webkit.messageHandlers.iap = handler('${IapBridge.HANDLER_NAME}');

              window.PickyNative = { platform: 'android' };
            })();
        """.trimIndent()
    }
}
