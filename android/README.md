# Picky Android

`https://picky.spectrify.kr` 를 띄우는 WebView 래퍼입니다. 화면·로직은 전부 웹에 있고,
이 앱은 웹이 브라우저에서 할 수 없는 일만 맡습니다. 구조는 [ios/](../ios/README.md) 의
`Picky` 와 같은 자리에 같은 이유로 놓여 있습니다.

```
android/
  app/src/main/
    java/kr/spectrify/picky/
      MainActivity.kt     앱 진입점 · 스플래시 · 뒤로 가기 · 시스템 바 배분
      AppConfig.kt        띄울 웹 주소 (Debug=로컬, Release=운영)
      PickyWebView.kt     WebView 설정 + 두 Client
    res/                  night 색 · 스플래시 · 런처 아이콘
    AndroidManifest.xml   세로 고정 · picky:// 스킴 · 외부 앱 queries
  app/src/debug/          로컬 개발 서버용 평문 HTTP 예외 (Release 에는 안 들어감)
```

| 설정          | 값                            |
| ------------- | ----------------------------- |
| applicationId | `kr.spectrify.picky`          |
| minSdk        | 26 (Android 8.0)              |
| compileSdk    | 37 (Android 17)               |
| targetSdk     | 37                            |
| 앱 스킴       | `picky://`                    |
| 방향          | 세로 고정                     |

**applicationId 는 Play Console 에 한 번 올라가면 바꿀 수 없습니다.** iOS Bundle ID 와
같은 값으로 맞춰 두었습니다.

## 개발 중 실행

**Debug 빌드는 운영이 아니라 로컬 개발 서버(`http://localhost:21001`)를 띄웁니다.**
이 앱은 화면을 갖지 않으므로, 운영만 본다면 웹을 배포하기 전에는 고친 화면을 앱에서 확인할 수
없습니다.

**기기의 localhost 는 기기 자신입니다.** 맥의 21001 에 닿으려면 adb 로 포트를 되돌려야 합니다 —
에뮬레이터·USB 실기기 모두 같은 명령입니다. 기기를 다시 연결하면 다시 걸어야 합니다.

```bash
pnpm dev                                  # 저장소 루트 — 서버(21000) + app(21001)
adb reverse tcp:21001 tcp:21001           # 기기 → 맥의 21001
./gradlew installDebug && adb shell am start -n kr.spectrify.picky/.MainActivity
```

> 에뮬레이터 전용 우회 주소 `10.0.2.2` 는 이 환경에서 닿지 않았습니다. adb reverse 가
> 실기기까지 같은 방식으로 덮으므로 그쪽을 기본으로 둡니다.

다른 주소를 보려면 빌드할 때 넘깁니다.

```bash
./gradlew installDebug -PpickyWebUrl=https://picky.spectrify.kr   # 디버그 빌드로 운영 보기
```

Release 는 무엇을 넣든 항상 운영을 봅니다 — 개발용 주소가 실린 빌드가 올라가는 사고를 막기 위해서입니다.

웹만 고쳤다면 앱을 다시 빌드할 필요 없이 앱을 껐다 켜면 됩니다.

### 웹 디버깅

Debug 빌드는 `setWebContentsDebuggingEnabled(true)` 라, 맥 크롬에서 `chrome://inspect` 로
이 WebView 를 붙잡아 개발자도구를 열 수 있습니다. 웹의 `console` 출력은 logcat 에도 `PickyWebView`
태그로 찍힙니다.

## 웹과 맞물리는 부분

### 1. 시스템 바 — 위는 네이티브, 아래는 웹

- **위쪽(상태바)은 네이티브가 night 로 덮습니다.** 상태바 글자색은 시스템 외관을 따르는데,
  그 자리를 웹이 그리게 하면 라이트 배경 화면(내 정보·결제)에서 흰 글자가 묻힙니다.
- **아래쪽(제스처 바)은 웹이 그립니다.** 네이티브가 덮으면 스크롤을 끝까지 내려도 콘텐츠가
  그 띠 위에서 잘리고, 밝은 화면에서는 아래에만 다크 띠가 남습니다.

⚠️ **안드로이드 WebView 의 `env(safe-area-inset-*)` 는 디스플레이 컷아웃만 반영하고 시스템 바는
반영하지 않습니다.** 웹(`app/src/globals.css`)은 `--safe-bottom` 으로 하단 CTA·바텀시트·네비게이션
여백을 전부 계산하므로, 네이티브가 그 값을 직접 넣어 줍니다 (`PickyWebView.applySafeBottom`).

주입은 `<head>` 에 `<style>` 을 얹는 방식입니다. `documentElement` 에 인라인 스타일을 주면
React 가 서버 HTML 과 다르다고 보고 하이드레이션 경고를 냅니다 — `<html>` 은 루트 레이아웃이
그리는 엘리먼트이기 때문입니다.

### 2. 스플래시

`MainActivity` 가 첫 픽셀(`onPageCommitVisible`)과 최소 1초 중 늦은 쪽에 시스템 스플래시를
걷습니다. 첫 픽셀이 오지 않는 경우(네트워크 오류 등) 2초 뒤 무조건 걷습니다 — iOS 와 같은 규칙입니다.

**배경색 `#121212` 과 마크 크기가 세 곳에서 같아야** 전환 때 그림이 튀지 않습니다.

- `res/values/themes.xml` 의 `Theme.Picky.Splash`
- `ios/Picky/Picky/PickyApp.swift` 의 `SplashView`
- `app/src/components/native-splash.tsx`

> Android 12+ 스플래시 아이콘은 288dp 캔버스를 원형으로 잘라냅니다. 마크가 별 모양이라
> 꽉 채우면 뿔이 잘려서, `res/drawable/splash_icon.xml` 에서 120dp 로 가운데 놓았습니다.

### 3. 뒤로 가기 — iOS 에 없는 처리

웹 히스토리가 남아 있으면 웹에서 뒤로 가고, 루트에서는 한 번 더 눌러야 나갑니다.
곧바로 종료하면 결제·작성 중에 실수로 앱이 꺼집니다.

### 4. 외부 앱 — `intent://`

카카오톡 로그인과 카드사 앱카드(ISP·페이북) 복귀가 전부 이 경로입니다. 안드로이드의 외부 앱
링크는 URL 이 아니라 `Intent.parseUri` 로 파싱해야 하고, 앱이 없으면 `browser_fallback_url` →
스토어 순으로 넘깁니다.

`AndroidManifest.xml` 의 `<queries>` 를 빼면 **API 30+ 에서 앱이 깔려 있어도 '없음' 으로 보입니다.**

## 아직 안 한 것

WebView 는 크롬이 아니라, 아래 것들은 **손대지 않으면 조용히 실패합니다** — 예외도 로그도 없이
아무 일이 일어나지 않습니다.

| 항목                     | 지금                         | 해야 할 것                                      |
| ------------------------ | ---------------------------- | ----------------------------------------------- |
| `<input type="file">`    | **눌러도 아무 일 없음**      | `WebChromeClient.onShowFileChooser`              |
| 카메라 (`capture`)       | 권한 요청을 거부하고 있음    | `onPermissionRequest` + CAMERA 런타임 권한       |
| `<a download>` / blob    | 저장 안 됨                   | `setDownloadListener`                            |
| 웹 ↔ 네이티브 브리지     | 없음                         | `webkit.messageHandlers` shim (아래)             |
| 결제                     | 없음                         | Google Play Billing + 서버 `POST /orders/google` |
| 광고                     | 없음                         | AdMob Android SDK + UMP                          |

### 브리지 계획

웹(`app/src/lib/native-app.ts`)은 `window.webkit.messageHandlers.<name>` 의 존재로 앱 여부와
기능 가용성을 가릅니다. iOS 전용 API 라 안드로이드에는 없으므로, **네이티브가 문서 로드 전에
shim 을 주입해 같은 모양을 만들어 줍니다** (`androidx.webkit` 의 `addDocumentStartJavaScript`).
그러면 웹을 한 줄도 고치지 않아도 됩니다.

답은 iOS 와 **같은 이벤트 이름**으로 돌려줍니다 — `picky:save-image-result`,
`picky:photo-result`, `picky:iap-result`, `picky:ad-result`.

**shim 에 올린 핸들러만 노출됩니다.** 아직 구현하지 않은 기능은 올리지 않으면 웹이 알아서
그 기능 없이 동작합니다(`isRewardedAdAvailable()` 등). 단 `iap` 은 예외입니다 — 웹은 브리지가
없으면 "예전 앱 빌드" 로 보고 업데이트를 안내하므로, 결제를 미루려면 웹에 분기가 필요합니다.
