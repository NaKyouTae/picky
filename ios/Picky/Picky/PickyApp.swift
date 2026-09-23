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
                // safe area 밖(상태바/홈 인디케이터 영역)은 앱 메인 화면과 같은 night 로 채운다.
                // 웹 셸의 배경(흰색)이 노치 영역에 남으면 다크 화면과 경계가 생긴다.
                Color.pickyNight.ignoresSafeArea()

                // WebView 는 safe area 안에 둔다(.ignoresSafeArea 를 붙이지 않는다).
                // 붙이면 WebView 뷰포트(innerHeight)가 실제 보이는 화면보다 커져서
                // 웹의 fixed 하단 요소(CTA·바텀시트)가 화면 아래로 밀려 안 보인다.
                WebView(url: AppConfig.webURL) {
                    isWebViewLoaded = true
                }

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
