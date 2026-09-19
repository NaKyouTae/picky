'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * 닫힘 애니메이션까지 보여주려면 'closed' 와 'closing' 을 구분해야 한다.
 * 부모가 상태를 들고 있고, 애니메이션이 끝나면 Modal 이 onClosed 로 알린다.
 */
export type DialogState = 'closed' | 'open' | 'closing';

/**
 * 화면 가운데 모달 셸.
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 이 오버레이는 셸 영역만 덮는다.
 */
export function Modal({
  state,
  onRequestClose,
  onClosed,
  labelledBy,
  children,
}: {
  state: DialogState;
  /** 배경 탭 · Escape 등으로 닫기를 요청할 때 — 부모가 'closing' 으로 바꾼다 */
  onRequestClose: () => void;
  /** 닫힘 애니메이션이 끝나 언마운트해도 될 때 */
  onClosed: () => void;
  /** 제목 요소의 id */
  labelledBy: string;
  children: React.ReactNode;
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
          'fixed inset-0 z-50 bg-black/40',
          closing ? 'animate-overlay-out' : 'animate-overlay-in',
        )}
      />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          // 열릴 때도 같은 핸들러가 불리므로 닫히는 중에만 언마운트한다.
          onAnimationEnd={() => {
            if (closing) onClosed();
          }}
          className={cn(
            'pointer-events-auto w-full rounded-2xl bg-white px-6 pb-6 pt-7',
            closing ? 'animate-pop-out' : 'animate-pop-in',
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
