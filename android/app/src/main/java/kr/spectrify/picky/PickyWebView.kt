package kr.spectrify.picky

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Message
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.net.URISyntaxException

/**
 * 운영 웹(`https://picky.spectrify.kr`)을 띄우는 WebView.
 *
 * 화면·로직은 전부 웹에 있고, 여기서 하는 일은 **안드로이드 WebView 가 기본으로 해 주지 않아
 * 웹이 브라우저에서와 다르게 동작하는 것들을 메우는 것**뿐이다. 구조는 iOS 의
 * `ios/Picky/Picky/WebView.swift` 와 같은 자리에 같은 이유로 놓여 있다.
 *
 * ⚠️ 안드로이드 WebView 는 크롬이 아니다. 아래 것들은 **손대지 않으면 조용히 실패한다** —
 * 예외도 로그도 없이 아무 일이 일어나지 않아서 원인을 찾기 어렵다.
 */
class PickyWebView(context: Context) : WebView(context) {

    /** 첫 픽셀이 그려진 시점 — MainActivity 가 스플래시를 걷는 데 쓴다. */
    var onFirstPaint: (() -> Unit)? = null

    /** 시스템 바 여백을 웹에 넘기기 위해 마지막으로 받은 값 (CSS px). */
    private var safeBottomCss: Float = 0f

    @SuppressLint("SetJavaScriptEnabled")
    fun configure() {
        settings.apply {
            javaScriptEnabled = true
            // localStorage / sessionStorage. 끄면 웹이 상태를 하나도 못 들고 있는다.
            domStorageEnabled = true
            // 자동재생·인라인 재생. 끄면 사용자가 누르기 전에는 미디어가 로드조차 안 된다.
            mediaPlaybackRequiresUserGesture = false
            // 토스 결제창·카드사 인증은 window.open 을 쓴다. 이게 false 면
            // onCreateWindow 가 아예 불리지 않아 결제창이 조용히 사라진다.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
            // 웹이 390px 모바일 고정 레이아웃이라 데스크톱 뷰포트로 잡히면 안 된다.
            useWideViewPort = true
            loadWithOverviewMode = false
            builtInZoomControls = false
            displayZoomControls = false
        }

        // BFF 의 httpOnly JWT 쿠키가 여기 달린다. 서드파티 쿠키를 막으면 로그인이 유지되지 않는다.
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(this@PickyWebView, true)
        }

        // 웹이 그려지기 전 한 프레임 동안 보이는 바탕. 메인 화면과 같은 night 로 둔다.
        setBackgroundColor(NIGHT)
        overScrollMode = OVER_SCROLL_NEVER
        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false

        webViewClient = Client()
        webChromeClient = ChromeClient()

        if (BuildConfig.DEBUG) {
            // 맥 크롬의 chrome://inspect 에서 이 WebView 를 붙잡아 디버깅할 수 있다.
            setWebContentsDebuggingEnabled(true)
        }
    }

    /**
     * 하단 시스템 바(제스처 바) 높이를 웹의 CSS 변수로 넘긴다.
     *
     * **안드로이드 WebView 의 `env(safe-area-inset-*)` 는 디스플레이 컷아웃만 반영하고
     * 시스템 바는 반영하지 않는다.** 웹(`app/src/globals.css`)은 `--safe-bottom` 으로
     * 하단 CTA·바텀시트·네비게이션 여백을 전부 계산하므로, 그 값을 네이티브가 직접 넣어 준다.
     * documentElement 의 인라인 스타일이라 스타일시트의 `env(...)` 선언을 덮어쓴다.
     *
     * 전체 페이지 로드가 일어나면 인라인 스타일이 날아가므로 그릴 때마다 다시 넣는다.
     */
    fun applySafeBottom(cssPx: Float) {
        safeBottomCss = cssPx
        injectSafeArea()
    }

    private fun injectSafeArea() {
        // documentElement 에 인라인 스타일을 주면 React 가 서버 HTML 과 다르다고 보고
        // 하이드레이션 경고를 낸다(<html> 은 루트 레이아웃이 그리는 엘리먼트다).
        // head 에 <style> 을 하나 얹으면 React 가 그리지 않은 노드라 건드리지 않는다.
        val js = """
            (function () {
              if (!document.head) return;
              var id = 'picky-native-safe-area';
              var el = document.getElementById(id);
              if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
              el.textContent = ':root{--safe-bottom:${safeBottomCss}px !important;}';
            })();
        """.trimIndent()
        evaluateJavascript(js, null)
    }

    private inner class Client : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            // http(s) 내비게이션은 모두 WebView 안에서 처리한다.
            // 결제·로그인 페이지의 링크까지 외부 브라우저로 넘기면 세션이 끊긴다.
            if (url.scheme == "http" || url.scheme == "https") return false
            return openExternal(url.toString())
        }

        /**
         * 로드 실패. **이게 없으면 화면만 까맣게 남고 로그에 아무것도 안 찍힌다** —
         * WebView 는 실패를 조용히 삼킨다.
         */
        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            if (!request.isForMainFrame) return
            Log.e(TAG, "load failed ${request.url}: ${error.errorCode} ${error.description}")
        }

        override fun onReceivedHttpError(
            view: WebView,
            request: WebResourceRequest,
            response: WebResourceResponse,
        ) {
            if (!request.isForMainFrame) return
            Log.e(TAG, "http ${response.statusCode} ${request.url}")
        }

        /** 첫 픽셀이 그려진 시점. onPageFinished 는 JS 번들·데이터까지 끝나야 해서 훨씬 늦다. */
        override fun onPageCommitVisible(view: WebView, url: String) {
            injectSafeArea()
            onFirstPaint?.invoke()
        }

        override fun onPageFinished(view: WebView, url: String) {
            injectSafeArea()
        }
    }

    private inner class ChromeClient : WebChromeClient() {

        /** 웹의 console 출력을 logcat 으로 넘긴다 — 앱 안에서는 개발자도구를 바로 못 연다. */
        override fun onConsoleMessage(message: ConsoleMessage): Boolean {
            Log.d(TAG, "console: ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
            return true
        }

        /**
         * 토스 결제창·카드사 인증 페이지는 `window.open` 으로 창을 띄운다.
         * 이걸 구현하지 않으면 WebView 가 그 요청을 조용히 버려서 결제 화면이 아예 뜨지 않는다.
         * 새 창을 따로 만들지 않고 지금 WebView 에서 이어서 연다 — iOS 의 `createWebViewWith` 와 같다.
         */
        override fun onCreateWindow(
            view: WebView,
            isDialog: Boolean,
            isUserGesture: Boolean,
            resultMsg: Message,
        ): Boolean {
            // 새 창 요청의 목적지는 이 임시 WebView 가 대신 받아서 원래 WebView 로 넘긴다.
            val relay = WebView(view.context)
            relay.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    v: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val url = request.url
                    if (url.scheme == "http" || url.scheme == "https") {
                        if (!AppConfig.isOurHost(url.host) && isUserGesture) {
                            // 서비스 바깥 사이트를 새 창으로 여는 링크는 기본 브라우저로 넘긴다.
                            openExternal(url.toString())
                        } else {
                            view.loadUrl(url.toString())
                        }
                    } else {
                        openExternal(url.toString())
                    }
                    v.destroy()
                    return true
                }
            }
            (resultMsg.obj as WebView.WebViewTransport).webView = relay
            resultMsg.sendToTarget()
            return true
        }

        /** 챌린지 인증 사진은 `<input type="file" capture="environment">` 로 찍는다. */
        override fun onPermissionRequest(request: PermissionRequest) {
            // TODO(Phase 2): CAMERA 런타임 권한을 먼저 받고 그 결과로 grant/deny 한다.
            request.deny()
        }
    }

    /**
     * 외부 앱을 연다 — 카카오톡 로그인, 카드사 앱카드(ISP·페이북) 복귀가 전부 이 경로다.
     *
     * 안드로이드의 외부 앱 링크는 `intent://...#Intent;...;end` 형태라 URL 이 아니라
     * Intent 로 파싱해야 한다. 앱이 없으면 `browser_fallback_url` → 스토어 순으로 넘긴다.
     */
    private fun openExternal(url: String): Boolean {
        val intent = try {
            Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
        } catch (e: URISyntaxException) {
            return false
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        // 웹이 연 링크가 우리 앱 안의 화면을 마음대로 열지 못하게 한다.
        intent.addCategory(Intent.CATEGORY_BROWSABLE)
        intent.component = null
        intent.selector = null

        try {
            context.startActivity(intent)
            return true
        } catch (e: ActivityNotFoundException) {
            // 앱이 안 깔려 있다 — 웹이 지정한 대체 주소가 있으면 그걸 연다.
            intent.getStringExtra("browser_fallback_url")?.let {
                loadUrl(it)
                return true
            }
            // 없으면 스토어로 보낸다.
            intent.`package`?.let { pkg ->
                try {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                    return true
                } catch (ignored: ActivityNotFoundException) {
                }
            }
        }
        return true
    }

    companion object {
        private const val TAG = "PickyWebView"

        /** globals.css 의 `--color-night: #121212` */
        val NIGHT = Color.parseColor("#121212")
    }
}
