'use client';

import { useEffect } from 'react';
import type { DialogState } from '@/components/modal';
import { cn } from '@/lib/utils';

/**
 * 인증 사진을 어떻게 넣을지 고르는 바텀시트 (디자인 4636:3608).
 *
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 셸 하단에 정확히 붙는다.
 * 고르는 즉시 파일 선택창이 떠야 하므로, 버튼은 부모가 넘긴 input 을 그 자리에서 연다 —
 * 사용자 제스처 안에서 `click()` 을 불러야 브라우저가 카메라·사진첩을 열어 준다.
 */
export function ChallengePhotoSheet({
  state,
  onTakePhoto,
  onPickFromLibrary,
  onRequestClose,
  onClosed,
}: {
  state: DialogState;
  /** 사진 찍기 — 카메라를 먼저 띄우는 input 을 연다 */
  onTakePhoto: () => void;
  /** 사진 보관함 — 기기에 저장된 사진을 고른다 */
  onPickFromLibrary: () => void;
  onRequestClose: () => void;
  onClosed: () => void;
}) {
  const closing = state === 'closing';

  // 데스크톱 웹에서 Escape 로 닫는다.
  useEffect(() => {
    if (state !== 'open') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, onRequestClose]);

  if (state === 'closed') return null;

  return (
    <>
      <div
        aria-hidden
        onClick={onRequestClose}
        className={cn(
          'fixed inset-0 z-50 bg-black/60',
          closing ? 'animate-overlay-out' : 'animate-overlay-in',
        )}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="인증 사진 넣기"
        // 열릴 때도 같은 핸들러가 불리므로 닫히는 중에만 언마운트한다.
        onAnimationEnd={() => {
          if (closing) onClosed();
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-6 rounded-t-3xl bg-night-card px-5 pt-4 font-mono text-night-text',
          closing ? 'animate-sheet-out' : 'animate-sheet-in',
        )}
        // 화면들과 같은 하단 여백 20px.
        style={{ paddingBottom: '20px' }}
      >
        {/* 손잡이 모양 — 끌어서 닫는 기능은 없고 시트라는 것만 알린다 */}
        <span className="h-[5px] w-36 rounded-full bg-night-sub" aria-hidden />

        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={onTakePhoto}
            className="h-[52px] w-full rounded-lg bg-night-raised text-[16px] font-medium leading-none active:bg-night-raised/70"
          >
            사진 찍기
          </button>
          <button
            type="button"
            onClick={onPickFromLibrary}
            className="h-[52px] w-full rounded-lg bg-night-raised text-[16px] font-medium leading-none active:bg-night-raised/70"
          >
            사진 보관함
          </button>
        </div>
      </section>
    </>
  );
}
