'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { DialogState } from '@/components/modal';
import type { CollageTemplate } from '@/lib/collage-templates';
import { cn } from '@/lib/utils';

/**
 * 템플릿 고르기 바텀시트 (디자인 4650:4248).
 *
 * 어드민이 올린 **고객용 샘플 콜라주**만 3열로 보여 준다 — 제목·설명 없이 그림만 고른다.
 * 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 셸 하단에 정확히 붙는다.
 */
export function CollageTemplateSheet({
  state,
  templates,
  hasMembership,
  membershipHref,
  selectedId,
  onSelect,
  onRequestClose,
  onClosed,
}: {
  state: DialogState;
  templates: CollageTemplate[];
  /** 회원권이 살아 있으면 유료 템플릿의 자물쇠를 푼다 */
  hasMembership: boolean;
  /** 잠긴 템플릿을 눌렀을 때 갈 구매 화면 */
  membershipHref: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
        // 디자인에 제목이 없어 화면에 글자를 두지 않는다 — 이름은 읽어 주기만 한다.
        aria-label="템플릿 선택"
        // 열릴 때도 같은 핸들러가 불리므로 닫히는 중에만 언마운트한다.
        onAnimationEnd={() => {
          if (closing) onClosed();
        }}
        className={cn(
          // 디자인(4650:4286) — 인증 사진 시트와 같은 껍데기다(둥근 모서리·손잡이·여백).
          // 높이는 내용만큼만 차지하다가 화면의 91%(디자인의 768/844)에서 멈추고,
          // 그때부터는 아래 목록이 스크롤된다.
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[91%] flex-col items-center gap-6 rounded-t-3xl bg-night-card px-5 pt-4 font-mono text-night-text',
          closing ? 'animate-sheet-out' : 'animate-sheet-in',
        )}
        // 화면들과 같은 하단 여백 20px.
        style={{ paddingBottom: '20px' }}
      >
        {/* 손잡이 모양 — 끌어서 닫는 기능은 없고 시트라는 것만 알린다 */}
        <span className="h-[5px] w-36 rounded-full bg-night-sub" aria-hidden />

        {/* 어드민이 올린 샘플 콜라주만 3열로 깐다 (디자인 4650:4370).
            카드는 디자인의 108x195 ≒ 세로 9:16 이고, 샘플을 꽉 채워 자른다. */}
        <ul className="grid min-h-0 w-full auto-rows-min grid-cols-3 gap-2.5 overflow-y-auto overscroll-contain">
          {templates.map((template) => {
            const selected = template.id === selectedId;
            // 회원권이 없으면 유료 템플릿은 고를 수 없다 — 자물쇠를 덮고 구매 화면으로 안내한다.
            const locked = template.isPaid && !hasMembership;

            const className = cn(
              'relative block aspect-[9/16] w-full overflow-hidden bg-night',
              // 디자인에는 선택 표시가 없지만, 지금 쓰는 템플릿은 드러나야 한다.
              selected && 'outline-2 -outline-offset-2 outline-point',
            );

            const thumbnail = (
              <>
                {/* 원격 이미지지만 목록 썸네일이라 최적화보다 단순함을 택한다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={template.previewImageUrl}
                  alt=""
                  className={cn('absolute inset-0 size-full object-cover', locked && 'opacity-40')}
                />

                {locked && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-9 items-center justify-center rounded-full bg-black/55 text-night-text">
                      <LockIcon />
                    </span>
                  </span>
                )}
              </>
            );

            return (
              <li key={template.id}>
                {/* 잠긴 카드는 고를 수 없으니 버튼이 아니라 구매 화면으로 가는 링크다 */}
                {locked ? (
                  <Link
                    href={membershipHref}
                    aria-label={`${template.title} (유료 템플릿 · 회원권 필요)`}
                    className={className}
                  >
                    {thumbnail}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(template.id)}
                    aria-current={selected ? 'true' : undefined}
                    aria-label={template.title}
                    className={className}
                  >
                    {thumbnail}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** 유료 템플릿 위에 올리는 잠긴 자물쇠 */
function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="size-5"
      aria-hidden
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
