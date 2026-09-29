package kr.spectrify.picky

import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updateLayoutParams
import androidx.lifecycle.lifecycleScope

/**
 * 앱 진입점. 화면은 WebView 하나뿐이라 레이아웃 XML 이 없다.
 *
 * 여기서 하는 일은 셋이다 — 스플래시를 언제 걷을지, 뒤로 가기를 어떻게 처리할지,
 * 시스템 바(상태바·제스처 바)를 웹과 어떻게 나눌지.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: PickyWebView
    private lateinit var fileChooser: FileChooser
    private lateinit var imageSaver: ImageSaver
    private lateinit var iapBridge: IapBridge

    /** 웹이 첫 화면을 그리기 시작했는지. */
    private var isWebViewLoaded = false

    /** 브랜드 노출 최소 시간이 지났는지. */
    private var minimumElapsed = false

    private var startedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)

        startedAt = SystemClock.elapsedRealtime()
        // 브랜드 노출 최소 1초 + 첫 픽셀. didCommit 이 오지 않는 경우(네트워크 오류 등)
        // 2초 뒤에는 무조건 걷는다 — iOS(PickyApp.swift)와 같은 규칙이다.
        splash.setKeepOnScreenCondition {
            val elapsed = SystemClock.elapsedRealtime() - startedAt
            if (elapsed >= MIN_SPLASH_MS) minimumElapsed = true
            if (elapsed >= SPLASH_TIMEOUT_MS) isWebViewLoaded = true
            !(isWebViewLoaded && minimumElapsed)
        }

        // targetSdk 35+ 는 edge-to-edge 가 강제다. 끄는 대신 어디까지 웹에 맡길지 정한다(아래).
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        // 상태바 자리는 night 로 채우므로 아이콘은 밝은 쪽이어야 보인다.
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false

        // registerForActivityResult 는 Activity 가 STARTED 되기 전에 끝나야 한다.
        fileChooser = FileChooser(this)
        imageSaver = ImageSaver(this)

        webView = PickyWebView(this).apply {
            configure()
            openFileChooser = fileChooser::open
        }

        iapBridge = IapBridge(
            activity = this,
            scope = lifecycleScope,
            // 답은 WebView 가 웹 이벤트로 돌려준다 (iOS 와 같은 이름).
            reply = { detail -> webView.dispatchEvent(IapBridge.RESULT_EVENT, detail.toString()) },
        )
        webView.installBridge(NativeBridge(webView, imageSaver, iapBridge))

        // 컨테이너의 night 가 상태바 자리에 드러난다.
        val container = FrameLayout(this).apply {
            setBackgroundColor(PickyWebView.NIGHT)
            addView(
                webView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
        }
        setContentView(container)

        webView.onFirstPaint = { isWebViewLoaded = true }
        applyInsets(container)
        handleBackPress()

        // restoreState 는 복원할 히스토리가 없으면 null 을 돌려준다. 그때 그냥 두면
        // 아무것도 로드하지 않은 빈 WebView 가 남아 화면이 까맣게 보인다.
        val restored = savedInstanceState?.let { webView.restoreState(it) }
        if (restored == null) {
            android.util.Log.i("Picky", "loadUrl ${AppConfig.webUrl}")
            webView.loadUrl(AppConfig.webUrl)
        }
    }

    /**
     * 시스템 바를 위아래로 다르게 나눈다.
     *
     * - **위쪽(상태바)은 네이티브가 덮는다.** 상태바 글자색은 시스템 외관을 따르는데, 그 자리를
     *   웹이 그리게 하면 라이트 배경 화면(내 정보·결제)에서 흰 글자가 묻힌다. night 로 둔다.
     * - **아래쪽(제스처 바)은 웹이 그린다.** 네이티브가 덮으면 스크롤을 끝까지 내려도 콘텐츠가
     *   그 띠 위에서 잘리고, 밝은 화면에서는 아래에만 다크 띠가 남는다. 대신 그 높이를
     *   `--safe-bottom` 으로 웹에 넘겨 하단 CTA·바텀시트가 제스처 바를 피하게 한다.
     */
    private fun applyInsets(container: FrameLayout) {
        ViewCompat.setOnApplyWindowInsetsListener(container) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            val density = resources.displayMetrics.density
            webView.updateLayoutParams<FrameLayout.LayoutParams> { topMargin = bars.top }
            // 위는 0 이다 — WebView 를 이미 상태바 아래로 내렸는데 웹이 컷아웃 높이를 또 보고
            // 피하면 여백이 두 배가 된다 (PickyWebView.applySafeArea).
            webView.applySafeArea(topCssPx = 0f, bottomCssPx = bars.bottom / density)
            insets
        }
    }

    /**
     * 뒤로 가기 — iOS 에 없는 처리다.
     *
     * 웹 히스토리가 남아 있으면 웹에서 뒤로 가고, 루트에서는 한 번 더 눌러야 나간다.
     * 곧바로 종료하면 결제·작성 중에 실수로 앱이 꺼진다.
     */
    private fun handleBackPress() {
        var lastBackAt = 0L
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                    return
                }
                val now = SystemClock.elapsedRealtime()
                if (now - lastBackAt < EXIT_CONFIRM_MS) {
                    finish()
                } else {
                    lastBackAt = now
                    android.widget.Toast
                        .makeText(this@MainActivity, R.string.exit_confirm, android.widget.Toast.LENGTH_SHORT)
                        .show()
                }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        super.onPause()
        // 쿠키를 디스크에 내린다. 이걸 빼면 앱이 강제 종료될 때 로그인이 날아갈 수 있다.
        android.webkit.CookieManager.getInstance().flush()
    }

    companion object {
        private const val MIN_SPLASH_MS = 1_000L
        private const val SPLASH_TIMEOUT_MS = 2_000L
        private const val EXIT_CONFIRM_MS = 2_000L
    }
}
