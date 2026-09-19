'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { StickerTemplate } from '@/lib/sticker-templates';
import { cn } from '@/lib/utils';

/** closing 을 따로 두어 닫힐 때도 애니메이션을 보여준 뒤 언마운트한다 */
type SheetState = 'closed' | 'open' | 'closing';

/**
 * '스티커 보기' 버튼 + 바텀시트.
 *
 * 시트 높이는 앱 셸의 70%. 셸이 translate 로 fixed 의 컨테이닝 블록이라
 * `h-[70%]` 가 뷰포트가 아니라 셸 높이를 기준으로 계산된다.
 * 목록은 1행 3열 그리드이고 시트 안에서만 스크롤된다.
 */
export function StickerSheetButton({ templates }: { templates: StickerTemplate[] }) {
  const [state, setState] = useState<SheetState>('closed');
  const closing = state === 'closing';

  // 데스크톱 웹에서 Escape 로 닫는다.
  useEffect(() => {
    if (state !== 'open') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setState('closing');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  // 시트 뒤 본문이 함께 스크롤되지 않도록 셸의 스크롤을 잠근다.
  useEffect(() => {
    if (state === 'closed') return;

    const container = document.getElementById('app-scroll-container');
    if (!container) return;

    const previous = container.style.overflowY;
    container.style.overflowY = 'hidden';
    return () => {
      container.style.overflowY = previous;
    };
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setState('open')}
        aria-haspopup="dialog"
        aria-expanded={state !== 'closed'}
        className="h-12 w-full rounded-2xl border border-line bg-white text-base font-semibold text-ink active:bg-gray-50"
      >
        스티커 보기
      </button>

      {state !== 'closed' && (
        <>
          <div
            aria-hidden
            onClick={() => setState('closing')}
            className={cn(
              'fixed inset-0 z-50 bg-black/40',
              closing ? 'animate-overlay-out' : 'animate-overlay-in',
            )}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sticker-sheet-title"
            // 열릴 때도 같은 핸들러가 불리므로 닫히는 중에만 언마운트한다.
            onAnimationEnd={() => {
              if (closing) setState('closed');
            }}
            className={cn(
              'safe-bottom fixed inset-x-0 bottom-0 z-50 flex h-[70%] flex-col rounded-t-2xl bg-white',
              closing ? 'animate-sheet-out' : 'animate-sheet-in',
            )}
          >
            <header className="shrink-0 border-b border-line px-5 pb-3 pt-2.5">
              {/* 시트임을 알려주는 핸들 표시 (드래그 제스처는 아직 없음) */}
              <div className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
              <div className="mt-3 flex items-center">
                <div>
                  <h2 id="sticker-sheet-title" className="text-base font-bold">
                    스티커
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-sub">
                    챌린지 사진을 한 장으로 모아 주는 템플릿이에요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setState('closing')}
                  aria-label="닫기"
                  className="-mr-2 ml-auto flex size-11 shrink-0 items-center justify-center text-ink-sub"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    className="size-5"
                    aria-hidden
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {templates.length === 0 ? (
                <p className="py-14 text-center text-sm text-ink-sub">
                  아직 준비된 스티커가 없어요.
                  <br />곧 새 스티커로 찾아올게요.
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-2.5">
                  {templates.map((template) => (
                    <li key={template.id}>
                      <div
                        className="relative w-full overflow-hidden rounded-xl border border-line bg-gray-50"
                        style={{ aspectRatio: `${template.imageWidth} / ${template.imageHeight}` }}
                      >
                        <Image
                          src={template.imageUrl}
                          alt={template.title}
                          fill
                          sizes="(max-width: 430px) 33vw, 140px"
                          className="object-contain"
                        />
                      </div>
                      <p className="mt-1.5 truncate text-[11px] font-medium">{template.title}</p>
                      <p className="text-[10px] text-ink-sub">사진 {template.slots.length}장</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
