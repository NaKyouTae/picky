'use client';

import { useEffect, useRef } from 'react';
import loaderAnimation from './picky-loader.lottie.json';

/**
 * 로딩 화면을 최소 이만큼은 보여준다 — 뽑는 느낌만 주고 길게 잡지 않는다.
 * 실제 대기는 `max(요청 시간, MIN_DRAW_MS)` 이므로, 요청이 이보다 느리면 그쪽이 체감 시간을 결정한다.
 */
export const MIN_DRAW_MS = 900;

/**
 * 최소 노출 시간을 재는 타이머.
 *
 * 요청을 보내기 **전에** 걸어 두고 응답을 받은 뒤 `await` 한다. 이렇게 하면
 * 실제 대기는 `max(요청 시간, MIN_DRAW_MS)` 가 되어, 응답이 빨라도 로딩이
 * 깜빡이고 끝나지 않는다. (경과 시간을 `Date.now()` 로 재면 렌더 순수성 규칙에 걸린다)
 */
export function startMinimumDraw(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MIN_DRAW_MS));
}

/**
 * 로티 로더.
 *
 * 플레이어(lottie-web)는 이 오버레이가 뜰 때 처음 필요하므로 동적으로 불러온다 —
 * 정적 import 하면 첫 화면 번들에 ~170KB 가 그대로 얹힌다.
 * expressions 를 쓰지 않는 애니메이션이라 light 빌드로 충분하다.
 */
function LoaderLottie() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;

    // 언마운트가 import 보다 빠를 수 있다 — 그때는 만들지 않고 끝낸다.
    let cancelled = false;
    let animation: { destroy: () => void } | null = null;

    void import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (cancelled) return;
      animation = lottie.loadAnimation({
        container: node,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: loaderAnimation,
      });
    });

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, []);

  return <div ref={container} className="size-20" aria-hidden />;
}

/**
 * 챌린지를 뽑는 동안 보여주는 전체 화면 로딩.
 *
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 이 오버레이가 셸(= 모바일 화면) 전체를 덮는다.
 * 카테고리를 골라 시작할 때와 '다시 뽑기' 에서 같은 화면을 쓴다.
 *
 * 보이는 문구("Pick your joy_")는 브랜드 로더라 그대로 두고, 무엇을 기다리는지는
 * 읽어 주는 문장으로만 가른다 — 다시 뽑기 전에 광고를 불러오는 동안에도 같은 화면을 쓴다.
 */
export function ChallengeDrawOverlay({ label = '챌린지를 뽑고 있어요' }: { label?: string } = {}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-night px-5 pb-[54px]"
    >
      <LoaderLottie />
      <p className="font-mono text-sm leading-none text-night-text">Pick your joy_</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
