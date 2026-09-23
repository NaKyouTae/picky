'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsNativeApp } from '@/lib/native-app';

/** 네이티브 런치 스크린과 같은 배경 (ios/Picky/Picky/PickyApp.swift 의 Color.pickyNight) */
const SPLASH_BG = '#121212';
/** 마크 높이 — 스토리보드·SwiftUI SplashView 와 같은 120 이어야 전환 때 크기가 튀지 않는다 */
const MARK_HEIGHT = 120;
/** 마운트 후 이만큼 더 덮고 있다가 걷는다. 네이티브가 스플래시를 내리는 시점(최소 1s)을 넘긴다. */
const HOLD_MS = 600;
/** 페이드 시간 — 네이티브의 0.3s 와 같은 값 */
const FADE_MS = 300;
const SPLASH_SESSION_FLAG = 'picky_splash_shown';

/**
 * 네이티브 스플래시를 웹이 이어받는다.
 *
 * 네이티브는 웹의 첫 렌더(didCommit)가 잡히면 자기 스플래시를 걷는데,
 * 그 시점의 웹은 아직 하이드레이션 전이라 화면이 덜컥 바뀌어 보인다.
 * 그래서 앱에서 처음 들어왔을 때만 같은 배경·같은 마크를 잠깐 덮었다가
 * 네이티브가 물러난 뒤에 페이드로 걷는다.
 *
 * 웹 브라우저에서는 보여주지 않는다 — 이어받을 네이티브 스플래시가 없다.
 */
export function NativeSplash() {
  const isNativeApp = useIsNativeApp();

  // 한 세션에 첫 진입 1회만. isNativeApp 은 서버/첫 렌더에서 false 라
  // lazy initializer 로 sessionStorage 를 읽어도 하이드레이션이 어긋나지 않는다.
  const [skip] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(SPLASH_SESSION_FLAG) === '1';
    } catch {
      // 프라이빗 모드 등에서 접근이 막히면 그냥 매번 보여준다.
      return false;
    }
  });

  /** 'covering' 덮는 중 → 'fading' 사라지는 중 → 'done' DOM 에서 제거 */
  const [phase, setPhase] = useState<'covering' | 'fading' | 'done'>('covering');

  const active = isNativeApp && !skip && phase !== 'done';

  useEffect(() => {
    if (!isNativeApp || skip) return;

    try {
      sessionStorage.setItem(SPLASH_SESSION_FLAG, '1');
    } catch {
      // 저장 못 해도 스플래시 자체는 정상 동작한다.
    }

    const fade = setTimeout(() => setPhase('fading'), HOLD_MS);
    const done = setTimeout(() => setPhase('done'), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [isNativeApp, skip]);

  // 앱 셸(layout.tsx)은 translate 를 가지므로 그 안에 fixed 로 두면 inset:0 이
  // 셸 박스(390px · --app-h)에 갇힌다. 화면 전체를 덮는 네이티브 스플래시가 걷힐 때
  // 작은 박스로 줄어드는 것처럼 보이므로, 포털로 body 에 직접 붙여 뷰포트 전체를 덮는다.
  const overlay =
    active && typeof document !== 'undefined'
      ? createPortal(
          <div
            aria-hidden
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100dvh',
              zIndex: 2000,
              backgroundColor: SPLASH_BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
              overscrollBehavior: 'none',
              opacity: phase === 'fading' ? 0 : 1,
              transition: `opacity ${FADE_MS}ms ease-out`,
              pointerEvents: phase === 'fading' ? 'none' : 'auto',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" style={{ height: MARK_HEIGHT, width: 'auto' }} />
          </div>,
          document.body
        )
      : null;

  return overlay;
}
