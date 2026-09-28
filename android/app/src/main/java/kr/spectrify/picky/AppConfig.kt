package kr.spectrify.picky

/**
 * 앱이 띄울 웹 주소.
 *
 * 이 앱은 화면을 갖지 않고 웹을 그대로 띄우므로, 운영 URL 만 본다면 웹을 배포하기 전에는
 * 고친 화면을 앱에서 확인할 수 없다. 그래서 Debug 빌드는 로컬 개발 서버(`pnpm dev:app`)를 본다.
 *
 * **에뮬레이터의 localhost 는 에뮬레이터 자신이다.** 맥의 21001 에 닿으려면 `10.0.2.2` 를
 * 거쳐야 한다 — iOS 시뮬레이터가 맥의 localhost 를 그대로 보는 것과 다르다.
 * 주소를 바꾸려면 빌드할 때 `-PpickyWebUrl=...` 을 넘긴다 (app/build.gradle.kts).
 *
 * Release 는 무엇을 넣든 항상 운영이다 — 개발용 주소가 실린 빌드가 올라가는 사고를 막는다.
 */
object AppConfig {
    val webUrl: String = BuildConfig.WEB_URL

    /**
     * 우리 서비스의 호스트인지.
     *
     * `contains` 가 아니라 정확히 일치하거나 하위 도메인인지를 본다 —
     * `contains` 는 `spectrify.kr.example.com` 같은 남의 주소도 우리 것으로 읽는다.
     * 디버그 빌드에서 로컬 개발 서버를 띄웠을 때를 위해 실제로 로드한 호스트도 함께 친다.
     */
    fun isOurHost(host: String?): Boolean {
        if (host == null) return false
        if (host == "spectrify.kr" || host.endsWith(".spectrify.kr")) return true
        return host == android.net.Uri.parse(webUrl).host
    }
}
