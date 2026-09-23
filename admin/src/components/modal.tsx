'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** 내용 폭 — 이미지 위에서 영역을 찍는 편집기처럼 넓은 화면이 필요할 때 lg 를 쓴다 */
const WIDTHS = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
} as const;

/**
 * 공용 모달.
 * 네이티브 <dialog> 의 showModal() 을 쓰므로 포커스 트랩·Esc 닫기·배경 비활성화를 브라우저가 처리한다.
 * children 은 열려 있을 때만 렌더해서, 다시 열면 폼이 초기 상태로 시작한다.
 */
export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof WIDTHS;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      // Esc 는 기본 동작(닫기) 대신 상위 상태를 바꿔 닫는다 — open 과 어긋나지 않도록
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // dialog 자체가 타깃이면 배경(::backdrop)을 누른 것이다
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        // 모바일은 화면 폭을 거의 다 쓰고, 세로는 dvh 로 잡는다(vh 는 주소창 높이를 빼지 않는다)
        'm-auto w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-black/40 sm:w-[calc(100vw-2rem)]',
        WIDTHS[size],
      )}
    >
      {open && (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6 sm:py-4">
            <h2 id="modal-title" className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-mr-1 flex size-10 items-center justify-center rounded-lg text-xl leading-none text-ink-sub hover:bg-gray-100 sm:-mr-2 sm:size-8"
            >
              ×
            </button>
          </div>
          <div className="max-h-[75dvh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
