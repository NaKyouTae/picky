'use client';

import { useEffect } from 'react';

/**
 * 모바일 브라우저/WebView 의 100vh 문제 보정.
 * visualViewport.height(없으면 innerHeight) 기준으로 --vh / --app-h 를 설정해
 * dvh 미지원 브라우저에서도 실제 보이는 높이에 앱 셸을 맞춘다.
 */
export function ViewportHeightSetter() {
  useEffect(() => {
    function setViewportVars() {
      const vvHeight = window.visualViewport?.height ?? window.innerHeight;
      const screenH = window.screen.height;
      // iPad 등에서 WebView 뷰포트가 실제 화면(screen.height)보다 크게 잡혀
      // 위/아래 고정 요소가 화면 밖으로 잘리는 경우를 보정한다.
      const visibleHeight = screenH && screenH < vvHeight ? screenH : vvHeight;

      document.documentElement.style.setProperty('--vh', `${visibleHeight * 0.01}px`);
      document.documentElement.style.setProperty('--app-h', `${visibleHeight}px`);

      // Android 홈화면 추가(standalone)에서는 하단 UI가 없는데도 inset 이 남는 경우가 있어 0 보정.
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const isAndroid = /android/i.test(window.navigator.userAgent);

      if (isStandalone && isAndroid) {
        document.documentElement.style.setProperty('--safe-bottom', '0px');
      } else {
        document.documentElement.style.removeProperty('--safe-bottom');
      }
    }

    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    setViewportVars();
    window.addEventListener('resize', setViewportVars);
    window.addEventListener('orientationchange', setViewportVars);
    standaloneMq.addEventListener('change', setViewportVars);
    window.visualViewport?.addEventListener('resize', setViewportVars);

    return () => {
      window.removeEventListener('resize', setViewportVars);
      window.removeEventListener('orientationchange', setViewportVars);
      standaloneMq.removeEventListener('change', setViewportVars);
      window.visualViewport?.removeEventListener('resize', setViewportVars);
    };
  }, []);

  return null;
}
