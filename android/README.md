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

⚠️ **`env(safe-area-inset-*)` 를 웹에 그대로 맡기면 위아래가 모두 어긋납니다.** 그래서 두 값 다
네이티브가 정해 줍니다 (`PickyWebView.applySafeArea`).

| | WebView 의 `env()` | 증상 | 넣어 주는 값 |
| --- | --- | --- | --- |
| 아래 | 시스템 바를 **반영하지 않음** | 하단 CTA·바텀시트가 제스처 바에 겹침 | `navigationBars` 높이 |
| 위 | 크로미움이 WebView 위치가 아니라 **창의 디스플레이 컷아웃**에서 계산 | 상태바 자리는 네이티브가 이미 덮었는데 웹이 컷아웃 높이를 또 피해 **여백이 두 배** | `0` |

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

### 4. 파일 선택 — `<input type="file">`

WebView 는 파일 입력을 스스로 처리하지 않습니다. `onShowFileChooser` 를 구현하지 않으면
**눌러도 예외도 로그도 없이 아무 일이 일어나지 않습니다** ([FileChooser.kt](app/src/main/java/kr/spectrify/picky/FileChooser.kt)).

**런타임 권한을 하나도 쓰지 않습니다.** 사진첩은 `ACTION_GET_CONTENT`(Android 13+ 에서는 시스템
사진 선택기로 연결), 촬영은 카메라 앱에 맡기는 `ACTION_IMAGE_CAPTURE` 라 **매니페스트에 `CAMERA`
를 선언하지 않는 한** 권한이 필요 없습니다. 선언하면 그때부터 쓰지도 않는 권한을 사용자에게
묻게 되므로 일부러 넣지 않았습니다. (웹은 `getUserMedia` 를 쓰지 않아 `onPermissionRequest` 는
거부가 맞습니다.)

두 가지 함정이 있습니다.

- ⚠️ **`FileChooserParams.parseResult` 를 쓰면 안 됩니다.** AOSP 구현이 `intent.getData()` 하나만
  보고 `ClipData` 는 읽지 않습니다. `<input multiple>`(문의 첨부)로 띄우면 결과가 **항상
  ClipData 로 오기 때문에** 그 함수는 늘 null 을 주고, 웹은 빈 `files` 를 받아 조용히 아무 일도
  하지 않습니다. 직접 파싱해야 합니다.
- ⚠️ **`ValueCallback` 은 반드시 한 번 불러야 합니다.** 취소도 결과이므로 `null` 로 답합니다.
  흘리면 그 `<input>` 은 **영영 다시 열리지 않습니다.**

촬영본은 FileProvider 의 `content://` 로 카메라 앱에 넘깁니다 — API 24+ 는 `file://` 을 앱 밖으로
넘기면 `FileUriExposedException` 으로 죽습니다. 경로는 [res/xml/file_paths.xml](app/src/main/res/xml/file_paths.xml).

### 5. 외부 앱 — `intent://`

카카오톡 로그인과 카드사 앱카드(ISP·페이북) 복귀가 전부 이 경로입니다. 안드로이드의 외부 앱
링크는 URL 이 아니라 `Intent.parseUri` 로 파싱해야 하고, 앱이 없으면 `browser_fallback_url` →
스토어 순으로 넘깁니다.

`AndroidManifest.xml` 의 `<queries>` 를 빼면 **API 30+ 에서 앱이 깔려 있어도 '없음' 으로 보입니다.**

## 아직 안 한 것

WebView 는 크롬이 아니라, 아래 것들은 **손대지 않으면 조용히 실패합니다** — 예외도 로그도 없이
아무 일이 일어나지 않습니다.

| 항목 | 지금 | 해야 할 것                              |
| ---- | ---- | --------------------------------------- |
| 광고 | 없음 | AdMob Android SDK + UMP (다시 뽑기)     |

결제는 코드가 다 들어갔지만 **Play Console 설정 전에는 동작하지 않습니다** (아래 9번).

### 6. 웹 ↔ 네이티브 브리지

웹(`app/src/lib/native-app.ts`)은 `window.webkit.messageHandlers.<name>` 의 존재로 앱 여부와
기능 가용성을 가릅니다. iOS 전용 API 라, **네이티브가 문서 로드 전에 shim 을 주입해 같은 모양을
만들어 줍니다** (`androidx.webkit` 의 `addDocumentStartJavaScript` ·
[NativeBridge.kt](app/src/main/java/kr/spectrify/picky/NativeBridge.kt)).
그래서 웹의 브리지 코드는 양쪽에 그대로 쓰입니다.

답은 iOS 와 **같은 이벤트 이름**으로 돌려줍니다 — `picky:save-image-result` 등.

**shim 에 올린 핸들러만 노출됩니다 — 그게 곧 기능 스위치입니다.**

| 핸들러      | 지금  | 메모                                                             |
| ----------- | ----- | ---------------------------------------------------------------- |
| `saveImage` | 노출  | 콜라주 저장. **웹은 이 핸들러의 존재로 앱인지 판별합니다**        |
| `iap`       | 노출  | Google Play Billing (IapBridge.kt)                               |
| `photos`    | 안 함 | 안드로이드는 `<input type=file>` 이 이미 사진 선택기를 바로 엽니다 |
| `ads`       | 안 함 | AdMob 전까지. 없으면 광고 없이 그냥 다시 뽑습니다                |

허용 오리진을 우리 주소로 좁힙니다 — 웹이 열어 주는 남의 페이지(카카오 로그인, 카드사 인증)에
네이티브 기능을 노출할 이유가 없습니다.

### 7. 결제 — 웹의 플랫폼 분기

⚠️ **`saveImage` 를 노출하면 웹의 `isNativeApp()` 이 true 가 되고, 그 플래그가 결제 화면도
같이 가립니다.** 그대로 두면 안드로이드에서 *"앱 업데이트가 필요해요 / App Store에서…"* 가
뜨고 결제가 통째로 막힙니다. 그래서 웹에 플랫폼 개념을 넣었습니다.

- shim 이 `window.PickyNative = { platform: 'android' }` 를 심습니다
- 웹의 `nativePlatform()` 이 이 값을 읽습니다 (표식이 없으면 iOS — 기존 빌드가 그대로 돌아야 하므로)
- `membership-purchase.tsx` · `membership-checkout.tsx` 가 플랫폼별로 상품 ID·엔드포인트를 고릅니다
- 브리지가 없는 빌드에서는 `reason="preparing"`(안드로이드) / `"outdated"`(iOS) 로 막습니다

**토스로 되돌리면 안 됩니다** — 앱 안 디지털 콘텐츠를 외부 결제로 파는 것은 Play 결제
정책(4.1) 위반입니다. "웹에서 구매하세요" 같은 안내도 안 됩니다(안티스티어링).

### 8. 콜라주 저장

```
웹  saveImageBlob(blob)               app/src/lib/save-image.ts
 →  webkit.messageHandlers.saveImage.postMessage({dataUrl})
 →  네이티브 MediaStore                ImageSaver.kt → Pictures/Picky/
 →  window 이벤트 'picky:save-image-result'  {ok} | {ok:false, reason:'denied'|'failed'}
```

`<a download>` 를 `setDownloadListener` 로 받으려는 시도는 헛수고입니다 — 웹이 넘기는 것은
`blob:` 주소인데 DownloadManager 는 그 스킴을 받지 못합니다. iOS 가 PHPhotoLibrary 로 우회한
것과 같은 이유로 같은 해법을 씁니다.

**Android 10(API 29)부터는 권한이 필요 없습니다.** 9 이하만 `WRITE_EXTERNAL_STORAGE` 가
필요해서 `maxSdkVersion="28"` 로 제한해 선언하고 저장할 때 한 번 묻습니다.

⚠️ `saveImage` 는 다른 브리지와 달리 **requestId 를 쓰지 않습니다** (한 번에 한 장만 저장).
⚠️ `@JavascriptInterface` 메서드는 **메인 스레드가 아닌 곳에서 불립니다.** `evaluateJavascript`
는 메인으로 넘겨야 합니다.

### 9. Google Play 인앱결제

```
웹: 결제하기       → iap.postMessage({action:'purchase', productId, requestId})
앱: Play Billing   → picky:iap-result { ok:true, transactionId: purchaseToken, productId }
웹: 토큰 전달      → POST /api/memberships/orders/google
서버: Play 조회    → 이용 기간 부여 → **구매 소비(consume)**  google-iap.service.ts
```

**iOS 와 다른 점이 셋입니다.**

| | iOS (StoreKit)                | 안드로이드 (Play Billing)                       |
| --- | ----------------------------- | ----------------------------------------------- |
| 검증 | 서명 영수증을 오프라인 검증   | **서버가 Play Developer API 에 직접 조회**      |
| 거래 닫기 | 앱이 `finish`            | **서버가 적립 직후 `consume`**                  |
| 상품 유형 | 비갱신 구독              | 소모성 일회성 상품(consumable INAPP)            |

거래를 서버가 닫는 이유: **Play 는 3일 안에 확인하지 않은 구매를 자동 환불합니다.** 앱에
맡기면 그 사이 앱이 꺼지거나 지워졌을 때 돈만 돌아가고 기간은 남습니다. 소비는 확인을 겸하고,
소모성 상품을 다시 살 수 있게도 만듭니다. 그래서 웹의 `finish` 는 안드로이드에서 호출되지
않고, 와도 아무 일도 하지 않습니다.

#### 에뮬레이터에서는 결제가 되지 않습니다

```
W BillingClient: In-app billing API version 3 is not supported on this device.
W PickyIap: Play Billing 연결 실패: Billing service unavailable on device.
```

Play Billing 은 **Play 스토어를 통해 설치된 빌드**에만 붙습니다. 로컬 디버그 APK 로는
`products` 가 빈 배열, `restore` 가 빈 배열로 떨어집니다 (브리지 자체는 정상 동작합니다).
실제 결제를 시험하려면 아래가 전부 필요합니다.

1. **Play Console 앱 등록** + 서명 키 · 내부 테스트 트랙에 AAB 업로드
2. **인앱 상품 등록** — 회원권마다 **소모성 일회성 상품**으로 (구독 아님)
3. **어드민 > 회원권**에 그 상품 ID 입력 (`googleProductId`)
4. **라이선스 테스터 등록** — Play Console > 설정 > 라이선스 테스트. 실제 청구 없이 시험 구매가 됩니다
5. **서버 환경변수** — `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
   (`server/.env.example` 참고). 서비스 계정 권한은 반영까지 **최대 24시간** 걸립니다
6. **DB 마이그레이션** — `prisma/migrations/20260929000000_add_google_iap`
