//
//  AppConfig.swift
//  Picky
//

import Foundation

enum AppConfig {
    static let productionURL = URL(string: "https://picky.spectrify.kr")!

    /// 앱이 띄울 웹 주소.
    ///
    /// 이 앱은 화면을 갖지 않고 웹을 그대로 띄우므로, 운영 URL 만 본다면 웹을 배포하기 전에는
    /// 고친 화면을 앱에서 확인할 수 없다. 그래서 Debug 빌드는 로컬 개발 서버(`pnpm dev:app`)를 본다.
    /// 시뮬레이터의 localhost 는 맥의 localhost 와 같아서 그대로 닿는다.
    ///
    /// 다른 주소를 보고 싶으면 스킴의 환경변수 `PICKY_WEB_URL` 로 덮어쓴다
    /// (Xcode → Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables).
    /// - 디버그 빌드로 운영을 보려면: `https://picky.spectrify.kr`
    /// - 실기기에서 로컬 서버를 보려면: `http://<맥의 LAN IP>:21001`
    ///   (실기기는 자기 자신의 localhost 를 보므로 IP 를 줘야 한다.
    ///    Info.plist 의 ATS 예외는 localhost 에만 걸려 있어 LAN IP 는 예외 추가가 더 필요하다.)
    ///
    /// Release 는 무엇을 넣든 항상 운영이다 — 개발용 주소가 실린 빌드가 올라가는 사고를 막는다.
    static let webURL: URL = {
        #if DEBUG
        if let override = ProcessInfo.processInfo.environment["PICKY_WEB_URL"],
           let url = URL(string: override) {
            return url
        }
        return URL(string: "http://localhost:21001")!
        #else
        return productionURL
        #endif
    }()
}

// MARK: - AdMob

extension AppConfig {
    /// 구글이 공개한 보상형 테스트 단위. 우리 계정과 무관해서 아무리 봐도 실적에 잡히지 않는다.
    private static let testRewardedAdUnitID = "ca-app-pub-3940256099942544/1712485313"

    /// TestFlight(또는 개발) 빌드인지.
    ///
    /// TestFlight 도 Release 빌드라 `#if DEBUG` 로는 갈라지지 않는다. 앱스토어 영수증이
    /// `sandboxReceipt` 인지로 본다 — 정식 배포본만 `receipt` 다.
    static let isTestFlight: Bool = {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }()

    /// 다시 뽑기에 붙는 보상형 광고 단위 ID (ios/Picky/Picky/AdBridge.swift).
    ///
    /// **정식 배포본에서만 실제 단위를 쓴다.** 개발 빌드는 물론 TestFlight 에서도 실제 광고를
    /// 띄우면 그 노출·시청 완료가 전부 실적으로 집계돼 무효 트래픽이 된다 — 구글이 가장 강하게
    /// 단속하는 항목이고 계정 정지로 이어진다.
    ///
    /// 앱 ID 는 여기가 아니라 Info.plist 의 `GADApplicationIdentifier` 다
    /// (값은 빌드 설정 `GAD_APPLICATION_IDENTIFIER` 에서 온다). 둘은 다른 값이고,
    /// 앱 ID 가 비어 있으면 SDK 가 실행 즉시 예외를 던진다.
    static let rewardedAdUnitID: String = {
        #if DEBUG
        return testRewardedAdUnitID
        #else
        if isTestFlight { return testRewardedAdUnitID }
        // TODO: AdMob 콘솔 → 광고 단위 → 보상형에서 만든 ID 로 교체할 것.
        // 이 자리가 그대로면 광고가 채워지지 않아 다시 뽑기가 항상 실패한다.
        return "ca-app-pub-0000000000000000/0000000000"
        #endif
    }()
}
