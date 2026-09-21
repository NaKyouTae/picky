/**
 * 두구두구 로딩을 최소 이만큼은 보여준다 — 뽑는 느낌만 주고 길게 잡지 않는다.
 * 실제 대기는 `max(요청 시간, MIN_DRAW_MS)` 이므로, 요청이 이보다 느리면 그쪽이 체감 시간을 결정한다.
 */
export const MIN_DRAW_MS = 900;

/**
 * 최소 노출 시간을 재는 타이머.
 *
 * 요청을 보내기 **전에** 걸어 두고 응답을 받은 뒤 `await` 한다. 이렇게 하면
 * 실제 대기는 `max(요청 시간, MIN_DRAW_MS)` 가 되어, 응답이 빨라도 두구두구가
 * 깜빡이고 끝나지 않는다. (경과 시간을 `Date.now()` 로 재면 렌더 순수성 규칙에 걸린다)
 */
export function startMinimumDraw(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MIN_DRAW_MS));
}

/**
 * 챌린지를 뽑는 동안 보여주는 전체 화면 로딩.
 *
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 이 오버레이가 셸(= 모바일 화면) 전체를 덮는다.
 * 이모지가 두구두구 튀고, 아래 그림자가 같은 박자로 줄었다 늘어 높이가 느껴지게 한다.
 *
 * 카테고리를 골라 시작할 때와 '다시 뽑기' 에서 같은 화면을 쓴다.
 */
export function ChallengeDrawOverlay({
  emoji,
  name,
}: {
  /** 카테고리 이모지 — 없으면 주사위로 대체한다 */
  emoji?: string | null;
  /** 카테고리 이름 — "{name} 챌린지를 뽑고 있어요" */
  name: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-white"
    >
      <div className="flex flex-col items-center">
        <span className="animate-drumroll text-6xl leading-none" aria-hidden>
          {emoji ?? '🎲'}
        </span>
        {/* 바닥 그림자 — 이모지와 같은 박자로 움직인다 */}
        <span className="animate-drum-shadow mt-4 h-1.5 w-12 rounded-full bg-ink" aria-hidden />
      </div>

      <p className="mt-8 text-lg font-bold tracking-tight">두구두구…</p>
      <p className="mt-1 text-sm text-ink-sub">{name} 챌린지를 뽑고 있어요</p>

      <div className="mt-6 flex gap-1.5" aria-hidden>
        <span className="animate-drum-dot size-2 rounded-full bg-brand-500" />
        <span className="animate-drum-dot size-2 rounded-full bg-brand-500 [animation-delay:0.15s]" />
        <span className="animate-drum-dot size-2 rounded-full bg-brand-500 [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
