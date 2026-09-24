//
//  PickyApp.swift
//  Picky
//

import SwiftUI

@main
struct PickyApp: App {
    /// 웹이 첫 화면을 그리기 시작했는지 (WebView 의 didCommit).
    @State private var isWebViewLoaded = false
    /// 브랜드 노출 최소 시간이 지났는지.
    @State private var minimumElapsed = false

    private var shouldHideSplash: Bool {
        isWebViewLoaded && minimumElapsed
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                // 상태바 영역은 앱 메인 화면과 같은 night 로 채운다.
                // 웹 셸의 배경(흰색)이 노치 영역에 남으면 다크 화면과 경계가 생긴다.
                Color.pickyNight.ignoresSafeArea()

                // 아래쪽 safe area(홈 인디케이터)는 WebView 가 덮고, 위쪽은 덮지 않는다.
                //
                // 아래를 덮지 않으면 웹뷰 프레임이 홈 인디케이터 34pt 위에서 끝난다.
                // 그 띠는 웹이 아예 그릴 수 없어 뒤의 night 가 드러나고, 스크롤을 끝까지
                // 내려도 콘텐츠가 화면 맨 아래에 닿지 못한 채 그 경계선에서 잘린다.
                // 웹 안에서는 env(safe-area-inset-bottom) 까지 0 으로 잡혀
                // globals.css 의 --safe-bottom / --page-bottom 이 통째로 무력화된다.
                // 덮어 주면 inset 이 제 값(34pt)으로 들어오고, 홈 인디케이터를 피하는 여백은
                // 웹이 --page-bottom(= safe-bottom + 20px)으로 직접 준다.
                // 예전에 fixed 하단 요소(CTA·바텀시트)가 화면 밖으로 밀렸던 것은
                // 웹에 그 여백 계산이 없던 때의 일이다.
                //
                // 위쪽까지 덮지 않는 이유 — 상태바 글자색은 시스템 외관을 따르는데,
                // 상태바 자리를 웹이 그리게 하면 라이트 배경 화면(내 정보·결제)에서
                // 다크모드 기기의 흰 글자가 묻힌다. 위쪽은 지금처럼 night 로 둔다.
                WebView(url: AppConfig.webURL) {
                    isWebViewLoaded = true
                }
                .ignoresSafeArea(.container, edges: .bottom)

                SplashView()
                    .ignoresSafeArea()
                    .opacity(shouldHideSplash ? 0 : 1)
                    .allowsHitTesting(!shouldHideSplash)
                    .animation(.easeOut(duration: 0.3), value: shouldHideSplash)
                    .zIndex(10)
            }
            .onAppear {
                // 브랜드 노출 최소 1초 보장
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    minimumElapsed = true
                }
                // didCommit 이 오지 않는 경우(네트워크 오류 등) 대비 2초 후 강제 dismiss
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    if !isWebViewLoaded {
                        isWebViewLoaded = true
                    }
                }
            }
        }
    }
}

extension Color {
    /// 메인 화면 배경 (globals.css 의 --color-night: #121212)
    static let pickyNight = Color(red: 18 / 255, green: 18 / 255, blue: 18 / 255)
}

/// 시스템 런치 스크린(Launch Screen.storyboard)과 같은 그림.
///
/// 두 화면이 어긋나면 런치 → SwiftUI 전환 순간에 마크가 점프한다.
/// 배경색·마크 크기(120pt)·정렬을 스토리보드와 똑같이 맞춘다.
/// 웹 쪽 splash(app/src/components/splash-provider.tsx)도 같은 값을 쓴다.
private struct SplashView: View {
    var body: some View {
        ZStack {
            Color.pickyNight
            Image("SplashMark")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 120)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
