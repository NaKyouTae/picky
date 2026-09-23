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
    Info.plist              URL 스킴 · 권한 문구
    Launch Screen.storyboard
    Assets.xcassets         AppIcon / SplashMark / AccentColor
```

Xcode 16 이상에서 `ios/Picky/Picky.xcodeproj` 를 열면 됩니다. 소스 폴더가
`PBXFileSystemSynchronizedRootGroup`(폴더 동기화 그룹)이라 **파일을 추가할 때
프로젝트에 등록하는 절차가 없습니다** — `Picky/` 안에 두면 자동으로 타깃에 들어갑니다.

| 설정 | 값 |
| --- | --- |
| Bundle ID | `kr.spectrify.picky` |
| Team | `43599V7UL7` (Spectrify) |
| URL 스킴 | `picky://` |
| 최소 버전 | iOS 17.0 |
| 방향 | 세로 고정 |

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

### 3. 결제 (토스페이먼츠)

- 결제창·카드사 인증은 `window.open` 을 쓰므로 `createWebViewWith` 가 필요합니다.
  이 델리게이트가 없으면 WKWebView 가 그 요청을 조용히 버려 결제창이 아예 뜨지 않습니다.
- 카드사 앱(ISP/페이북)에서 돌아오려면 앱 스킴이 필요합니다. 웹이 앱 안일 때만
  `card.appScheme = 'picky://'` 를 넘깁니다 ([membership-checkout.tsx](../app/src/components/membership-checkout.tsx)).
  `Info.plist` 의 `CFBundleURLTypes` 와 **같은 문자열이어야** 합니다.
- `http(s)` 내비게이션은 전부 WebView 안에서 처리합니다. 결제·로그인 페이지의 링크를
  사파리로 넘기면 세션이 끊겨 "비정상적인 시도" 오류가 납니다.

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
- **결제 (3.1.1)** — 회원권이 푸는 것은 앱 안에서 쓰는 디지털 콘텐츠(유료 콜라주 템플릿)입니다.
  이런 결제는 애플이 In-App Purchase 를 요구하므로, 토스페이먼츠 결제창을 그대로 두면
  반려될 가능성이 높습니다. IAP 를 붙이거나, iOS 앱에서는 결제 진입 자체를 감춰야 합니다.
  (감추는 쪽을 택하면 "웹에서 구매하세요" 같은 유도 문구·링크도 넣으면 안 됩니다 — 안티스티어링)
- **로그인 (4.8)** — Sign in with Apple 을 넣었습니다(카카오·네이버와 함께 3종).
  ⚠️ **Apple Developer 설정과 서버 환경변수(`APPLE_*`)를 먼저 채운 뒤 웹을 배포하세요.**
  비어 있으면 로그인 화면에 버튼만 보이고 누르면 실패합니다. 설정 항목은 `server/.env.example` 참고.
- **심사용 계정** — 소셜 로그인만 있으므로 App Review 정보에 테스트 계정을 적어야 합니다.
- **계정 삭제 (5.1.1(v))** — 이미 있습니다 (`app/src/components/withdraw-button.tsx`).
- **권한 문구** — 카메라·사진 접근 문구는 `Info.plist` 의 `NS*UsageDescription` 입니다.
  기능과 다르게 적혀 있으면 반려됩니다.
