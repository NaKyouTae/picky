# Picky iOS

`https://picky.spectrify.kr` 를 띄우는 WKWebView 래퍼입니다. 화면·로직은 전부 웹에 있고,
이 앱은 웹이 브라우저에서 할 수 없는 일(카드사 앱 복귀, 사진 앱 저장, 런치 스크린)만 맡습니다.
구조는 [baby-rang](https://github.com/NaKyouTae/baby-rang) 의 `ios/BabyRang` 을 따릅니다.

```
ios/Picky/
  Picky.xcodeproj
  Picky/
    PickyApp.swift          앱 진입점 · 스플래시 전환
    AppConfig.swift         띄울 웹 주소 (Debug=로컬, Release=운영)
    WebView.swift           WKWebView + 브리지
    IapBridge.swift         StoreKit 인앱결제
    AdBridge.swift          AdMob 보상형 광고 (다시 뽑기)
    Info.plist              URL 스킴 · 권한 문구 · AdMob 앱 ID
    Launch Screen.storyboard
    Assets.xcassets         AppIcon / SplashMark / AccentColor
```

Xcode 16 이상에서 `ios/Picky/Picky.xcodeproj` 를 열면 됩니다. 소스 폴더가
`PBXFileSystemSynchronizedRootGroup`(폴더 동기화 그룹)이라 **파일을 추가할 때
프로젝트에 등록하는 절차가 없습니다** — `Picky/` 안에 두면 자동으로 타깃에 들어갑니다.

| 설정      | 값                       |
| --------- | ------------------------ |
| Bundle ID | `kr.spectrify.picky`     |
| Team      | `43599V7UL7` (Spectrify) |
| URL 스킴  | `picky://`               |
| 최소 버전 | iOS 17.0                 |
| 방향      | 세로 고정                |
| 지원 기기 | iPhone 전용              |

**iPad 를 지원 기기에 넣으면 업로드가 거부됩니다**(`TARGETED_DEVICE_FAMILY`). 아이패드는
멀티태스킹 때문에 가로 두 방향까지 모두 지원해야 하는데, 이 앱은 390px 모바일 화면을
세로로 고정해 띄우므로 만족시킬 수가 없습니다 (App Store Connect 오류 90474).
iPhone 전용이어도 아이패드에는 호환 모드로 그대로 설치됩니다.

## 개발 중 실행

**Debug 빌드는 운영이 아니라 로컬 개발 서버(`http://localhost:21001`)를 띄웁니다.**
이 앱은 화면을 갖지 않으므로, 운영만 본다면 웹을 배포하기 전에는 고친 화면을 앱에서 확인할 수
없습니다. 시뮬레이터의 localhost 는 맥의 localhost 와 같아 그대로 닿습니다
([AppConfig.swift](Picky/Picky/AppConfig.swift)).

```bash
pnpm dev            # 저장소 루트에서 — 서버(21000) + app(21001)
```

Xcode 를 열어 ⌘R 해도 되고, 터미널에서 돌려도 됩니다.

```bash
# xcode-select 가 CommandLineTools 를 가리키고 있으면 DEVELOPER_DIR 로 넘긴다
# (영구히 바꾸려면: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer)
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

DEVICE=$(xcrun simctl list devices booted -j | python3 -c 'import json,sys; print(json.load(sys.stdin)["devices"].popitem()[1][0]["udid"])')

xcodebuild -project ios/Picky/Picky.xcodeproj -scheme Picky \
  -configuration Debug -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$DEVICE" \
  -derivedDataPath /tmp/picky-ios CODE_SIGNING_ALLOWED=NO build

xcrun simctl install booted /tmp/picky-ios/Build/Products/Debug-iphonesimulator/Picky.app
xcrun simctl launch booted kr.spectrify.picky
```

웹만 고쳤다면 앱을 다시 빌드할 필요 없이 앱을 껐다 켜면 됩니다
(`xcrun simctl terminate booted kr.spectrify.picky` 후 다시 launch).

다른 주소를 보려면 환경변수 `PICKY_WEB_URL` 로 덮어씁니다.

```bash
# 디버그 빌드로 운영을 보기
SIMCTL_CHILD_PICKY_WEB_URL=https://picky.spectrify.kr \
  xcrun simctl launch booted kr.spectrify.picky
```

Xcode 에서는 Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables 에 넣습니다.
Release 는 무엇을 넣든 항상 운영을 봅니다 — 개발용 주소가 실린 빌드가 올라가는 사고를 막기 위해서입니다.

> 개발 서버로 띄우면 화면 하단에 Next.js dev indicator("N" 배지)가 뜹니다. `next dev` 전용이라
> 운영·Release 빌드에는 없습니다.

## 웹과 맞물리는 부분

앱만 고치거나 웹만 고치면 어긋나는 지점들입니다. 한쪽을 바꾸면 반대쪽도 봐야 합니다.

### 1. 스플래시 (네이티브 → 웹)

`PickyApp.swift` 는 WebView 의 `didCommit`(HTML 도착) 시점과 최소 1초 중 늦은 쪽에
네이티브 스플래시를 0.3초 페이드로 걷습니다. 그 순간 웹은 아직 하이드레이션 전이라,
웹의 [`NativeSplash`](../app/src/components/native-splash.tsx) 가 같은 그림을 잠깐 더
덮고 있다가 이어서 걷습니다.

세 곳의 **배경색 `#121212` 과 마크 높이 `120` 이 같아야** 전환 때 그림이 튀지 않습니다.

- `Launch Screen.storyboard` (시스템 런치 스크린)
- `PickyApp.swift` 의 `SplashView`
- `app/src/components/native-splash.tsx`

### 2. 콜라주 저장

WKWebView 는 `<a download>` 를 무시해서 웹의 저장 경로가 아무 일도 하지 않습니다.
그래서 앱에서는 웹이 PNG 를 data URL 로 넘기고 네이티브가 사진 앱에 담습니다.

```
웹  saveImageToPhotos(blob)            app/src/lib/native-app.ts
 →  webkit.messageHandlers.saveImage
 →  네이티브 PHPhotoLibrary(.addOnly)   ios/Picky/Picky/WebView.swift
 →  window 이벤트 'picky:save-image-result'  { ok } | { ok:false, reason:'denied'|'failed' }
```

웹은 이 `saveImage` 핸들러의 존재로 "앱 안인지" 를 판별합니다(`isNativeApp()`).
**핸들러 이름을 바꾸면 앱 판별 자체가 깨집니다.**

### 3. 결제 — 앱은 인앱결제, 웹은 토스

**앱에서는 토스 결제창이 뜨지 않습니다.** 회원권이 푸는 것은 앱 안에서 쓰는 디지털 콘텐츠라
외부 결제로 팔 수 없습니다(App Review Guideline 3.1.1). 그래서 앱은 StoreKit 으로만 팝니다.

결제만 네이티브가 맡고 화면·적립은 그대로 웹·서버의 몫입니다
([IapBridge.swift](Picky/IapBridge.swift) ↔ [native-app.ts](../app/src/lib/native-app.ts)).

```
웹: 결제하기        → iap.postMessage({action:'purchase', productId, requestId})
네이티브: StoreKit  → picky:iap-result { ok:true, transactionId, signedTransactionInfo }
웹: 영수증 전달     → POST /api/memberships/orders/apple
서버: 서명 검증     → 이용 기간 부여 (apple-iap.service.ts)
웹: 적립 성공       → iap.postMessage({action:'finish', transactionId})
```

- **거래는 서버 적립이 끝난 뒤에 `finish` 합니다.** 먼저 닫으면 적립이 실패했을 때 영수증을
  다시 얻을 수 없어 돈만 빠져나간 상태가 됩니다. 닫지 않은 거래는 StoreKit 이 들고 있으므로
  결제 화면에 다시 들어오면 `restore` 로 꺼내 재적립할 수 있습니다.
- 웹은 `iap` 핸들러의 존재로 인앱결제 가능 여부를 가릅니다(`isIapAvailable()`).
  **핸들러 이름을 바꾸면 앱에서 결제가 통째로 막힙니다.**
- 브리지가 없는 예전 빌드에서는 토스로 되돌리지 않고 업데이트를 안내합니다 —
  앱 안에서 외부 결제가 보이면 그 자체가 반려 사유입니다.

로컬에서 실제 결제 없이 시험하려면 Xcode 의 **StoreKit Configuration File**
(File → New → File → StoreKit Configuration File)을 만들어 Scheme → Run → Options →
StoreKit Configuration 에 지정하세요. 상품 ID 는 App Store Connect 와 같게 맞춥니다.

웹(브라우저)은 그대로 토스페이먼츠를 씁니다. 앱에서는 이 경로를 타지 않지만,
카드사 앱 복귀용 설정은 남아 있습니다.

- 결제창·카드사 인증은 `window.open` 을 쓰므로 `createWebViewWith` 가 필요합니다.
  이 델리게이트가 없으면 WKWebView 가 그 요청을 조용히 버려 결제창이 아예 뜨지 않습니다.
- 카드사 앱(ISP/페이북)에서 돌아오려면 앱 스킴이 필요합니다
  ([membership-checkout.tsx](../app/src/components/membership-checkout.tsx)).
  `Info.plist` 의 `CFBundleURLTypes` 와 **같은 문자열이어야** 합니다.
- `http(s)` 내비게이션은 전부 WebView 안에서 처리합니다. 결제·로그인 페이지의 링크를
  사파리로 넘기면 세션이 끊겨 "비정상적인 시도" 오류가 납니다.

### 4. 광고 — 다시 뽑기는 보상형 광고를 끝까지 봐야 한다

**AdMob 광고는 WebView 안에서 띄울 수 없습니다.** 앱 광고는 Google Mobile Ads SDK 로만
서빙해야 하고, WebView 에 광고 태그를 심는 것은 무효 트래픽으로 잡혀 계정 정지 사유입니다.
그래서 결제와 같은 모양으로 나눕니다 — 재생만 네이티브가 하고, 보상(다시 뽑기)은
그대로 웹·서버가 줍니다 ([AdBridge.swift](Picky/AdBridge.swift) ↔
[native-app.ts](../app/src/lib/native-app.ts)).

```
웹: 화면 진입       → ads.postMessage({action:'prepare', requestId})   (동의 + 미리 받기)
웹: 다시 뽑기(Ad)   → 동의 모달 → ads.postMessage({action:'show', requestId})
네이티브: AdMob     → picky:ad-result { ok:true } | { ok:false, reason:'cancelled'|'unavailable' }
웹: ok 일 때만      → PATCH /api/challenge-groups/:id/redraw
```

- **`ok:true` 는 `userDidEarnReward` 가 불린 뒤에만 나갑니다.** 중간에 닫으면 `cancelled`
  이고 웹은 다시 뽑기를 진행하지 않습니다 — 보상형 광고는 끝까지 본 사람에게만 보상을
  줘야 합니다.
- **버튼 라벨의 `(Ad)` 와 동의 모달을 빼면 안 됩니다.** 광고임을 알리고 사용자가 스스로
  고르게 하는 것이 AdMob 보상형 정책의 조건이고, 숨기면 표시광고법상 기만적 표시·광고가
  됩니다 ([challenge-group-screen.tsx](../app/src/components/challenge-group-screen.tsx)).
- 동의 순서는 **UMP(동의 양식) → ATT(추적 허용) → SDK 시작** 입니다. 첫 `prepare` 에서
  한 번만 돕니다.
- 웹은 `ads` 핸들러의 존재로 광고 가능 여부를 가릅니다(`isRewardedAdAvailable()`).
  브리지가 없는 개발용 브라우저에서는 광고 없이 바로 뽑습니다.
- **ID 는 두 개이고 서로 다릅니다.** 앱 ID 는 `Info.plist` 의 `GADApplicationIdentifier`
  (값은 빌드 설정 `GAD_APPLICATION_IDENTIFIER`), 광고 단위 ID 는
  `AppConfig.rewardedAdUnitID` 입니다.
- **실제 광고는 정식 배포본에서만 나갑니다.** Debug 는 물론 **TestFlight 에서도 구글 테스트
  단위**를 씁니다(`AppConfig.isTestFlight`) — 테스트로 본 광고가 실적으로 집계되면
  무효 트래픽이 되어 AdMob 계정이 정지됩니다. TestFlight 는 Release 빌드라 `#if DEBUG` 로는
  갈라지지 않아, 앱스토어 영수증이 `sandboxReceipt` 인지로 판별합니다.
- 앱 ID 는 TestFlight 에서도 **실제 값이어야** 합니다. 테스트 단위와 짝지어도 상관없고,
  앱 ID 자체는 식별자일 뿐이라 실적과 무관합니다.

## 출시 절차

1. **버전** — `Picky.xcodeproj` 의 `MARKETING_VERSION`(표시 버전)과
   `CURRENT_PROJECT_VERSION`(빌드 번호)을 올립니다. 빌드 번호는 같은 버전으로
   두 번 올릴 수 없으니 업로드할 때마다 +1 합니다.
2. **웹 먼저 배포** — 앱은 운영 URL 을 그대로 띄우므로 Vercel 배포가 먼저입니다.
3. **아카이브** — Xcode → Product → Destination 을 `Any iOS Device` → Archive.
4. **업로드** — Organizer 에서 Distribute App → App Store Connect.
5. **심사 제출** — App Store Connect 에서 스크린샷·설명·개인정보 처리방침 URL 을 채우고 제출.

### 심사에서 걸리기 쉬운 것

- **앱 아이콘** — 지금 들어 있는 `AppIcon.png` 는 로고 마크를 night 바탕에 올린
  자동 생성본입니다. 디자인이 나오면 1024×1024 PNG(알파 없음)로 교체하세요.
- **결제 (3.1.1)** — 앱에서는 인앱결제만 씁니다(위 3번). 제출 전에 아래를 모두 확인하세요.
  1. **유료 앱 계약** — App Store Connect > 계약·세금·거래에서 '유료 앱' 계약이 **활성** 이어야
     합니다. 세금·은행 정보가 비어 있으면 상품이 앱에서 조회되지 않습니다(= `unavailable`).
  2. **인앱결제 상품 등록** — 회원권마다 **비갱신 구독(Non-Renewing Subscription)** 으로
     만듭니다. 기간제이고 자동갱신이 없는 현재 판매 방식과 일치합니다.
     (소모성/비소모성이 아닙니다 — 반복 구매로 기간을 이어 붙이기 때문입니다)
  3. **상품 ID 연결** — 어드민 > 회원권에서 각 회원권에 상품 ID 를 적습니다.
     비어 있으면 앱 결제 화면에 그 회원권이 보이지 않습니다.
  4. **서버 환경변수** — `APPLE_BUNDLE_ID`, `APPLE_APP_APPLE_ID` (`server/.env.example` 참고).
     `APPLE_APP_APPLE_ID` 가 비면 **Sandbox 결제만** 받습니다. 심사는 Sandbox 라 통과하지만
     출시 후 실제 결제가 전부 막히므로 운영 배포 전에 반드시 채우세요.
  5. **상품도 함께 심사 제출** — 첫 인앱결제 상품은 앱 버전과 같이 제출해야 심사됩니다.
     앱만 제출하면 상품이 '제출 준비 완료' 로 남아 심사원이 결제를 못 합니다.
  - 앱 안에 "웹에서 구매하세요" 같은 유도 문구·링크를 넣으면 안 됩니다(안티스티어링).
- **로그인 (4.8)** — Sign in with Apple 을 넣었습니다(카카오·네이버와 함께 3종).
  ⚠️ **Apple Developer 설정과 서버 환경변수(`APPLE_*`)를 먼저 채운 뒤 웹을 배포하세요.**
  비어 있으면 로그인 화면에 버튼만 보이고 누르면 실패합니다. 설정 항목은 `server/.env.example` 참고.
- **심사용 계정** — 소셜 로그인만 있으므로 App Review 정보에 테스트 계정을 적어야 합니다.
- **계정 삭제 (5.1.1(v))** — 이미 있습니다 (`app/src/components/withdraw-button.tsx`).
- **권한 문구** — 카메라·사진 접근 문구는 `Info.plist` 의 `NS*UsageDescription` 입니다.
  기능과 다르게 적혀 있으면 반려됩니다.
- **광고 (위 4번)** — 운영 빌드에 테스트 ID 가 남아 있으면 수익이 0 이고, 반대로 개발 중에
  실제 ID 를 쓰면 무효 트래픽으로 계정이 정지됩니다. 제출 전에 아래를 확인하세요.
  1. **Release 의 두 ID 교체** — 빌드 설정 `GAD_APPLICATION_IDENTIFIER`(Release)와
     `AppConfig.rewardedAdUnitID` 의 `#else` 쪽이 아직 `0000...` 자리표시자입니다.
  2. **SKAdNetworkItems** — `Info.plist` 에 구글 것 하나만 넣어 뒀습니다. 배포 전에
     [구글이 공개한 전체 목록](https://developers.google.com/admob/ios/data-disclosure#skadnetwork)
     으로 채우세요. 빠진 네트워크는 설치 성과가 안 잡혀 낙찰가가 떨어집니다.
  3. **App Privacy (App Store Connect)** — 광고 SDK 가 쓰는 항목을 신고해야 합니다.
     최소한 `Identifiers > Device ID`, `Usage Data`, 용도 `Third-Party Advertising`.
     [구글의 데이터 공시 안내](https://developers.google.com/admob/ios/data-disclosure) 참고.
  4. **개인정보 처리방침** — 제3자 광고 제공자로 Google AdMob 을 명시하고, 맞춤형 광고와
     그 거부 방법을 적어야 합니다.
  5. **연령 등급** — 광고가 붙으면 등급 설문의 답이 달라집니다. 다시 확인하세요.
  6. **ATT 문구** — `NSUserTrackingUsageDescription` 이 실제 용도와 같아야 합니다.
     ATT 를 붙였으므로 심사원이 프롬프트를 볼 수 있어야 합니다(챌린지 화면 진입 시).
  - 업로드 때 뜨는 `Upload Symbols Failed — dSYM for GoogleMobileAds` 경고는 무시해도
    됩니다. AdMob 은 dSYM 없는 바이너리 프레임워크로 배포돼 크래시 심볼만 못 붙을 뿐,
    업로드·심사에는 영향이 없습니다.
