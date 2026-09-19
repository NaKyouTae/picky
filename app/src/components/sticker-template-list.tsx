'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { StickerTemplate } from '@/lib/sticker-templates';
import { cn } from '@/lib/utils';

/**
 * 스티커 템플릿 목록.
 *
 * 카드마다 템플릿 이미지 위에 사진이 들어갈 자리를 번호와 함께 겹쳐 그려,
 * 몇 장을 어떤 배치로 넣게 되는지 고르기 전에 알 수 있게 한다.
 * 카드를 누르면 같은 그림을 크게 띄운다.
 */
export function StickerTemplateList({ templates }: { templates: StickerTemplate[] }) {
  const [preview, setPreview] = useState<StickerTemplate | null>(null);

  return (
    <div className="pb-page px-5 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">스티커</h1>
      <p className="mt-1 text-sm text-ink-sub">
        챌린지에서 찍은 사진을 한 장으로 모아 주는 템플릿이에요.
      </p>

      {templates.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-5 py-12 text-center">
          <p className="text-sm text-ink-sub">
            아직 준비된 템플릿이 없어요.
            <br />곧 새 스티커로 찾아올게요.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => setPreview(template)}
                className="w-full overflow-hidden rounded-2xl border border-line bg-white text-left active:bg-gray-50"
              >
                <SampleFrame template={template} sizes="(max-width: 430px) 50vw, 200px" />
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">{template.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-sub">사진 {template.slots.length}장</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 앱 셸이 translate 로 fixed 의 컨테이닝 블록이라 이 오버레이는 셸 기준으로 덮인다.
          하단 네비(z-50) 위에 와야 하므로 z-index 를 한 단계 올린다. */}
      {preview && (
        <div
          role="dialog"
          aria-modal
          aria-label={`${preview.title} 미리보기`}
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6"
        >
          {/* 시트 안쪽을 눌렀을 때는 닫히지 않도록 이벤트를 막는다 */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full overflow-hidden rounded-2xl bg-white"
          >
            <SampleFrame template={preview} sizes="(max-width: 430px) 90vw, 380px" />
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{preview.title}</p>
                <p className="mt-0.5 text-xs text-ink-sub">
                  번호 순서대로 사진 {preview.slots.length}장이 채워져요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="ml-auto h-11 shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 템플릿 한 장의 샘플 그림.
 * 앱에서 합성할 때와 같은 순서로 그린다 — 템플릿을 깔고 그 위에 사진 칸을 올린다.
 */
function SampleFrame({
  template,
  sizes,
  className,
}: {
  template: StickerTemplate;
  sizes: string;
  className?: string;
}) {
  return (
    <div
      className={cn('relative w-full bg-gray-100', className)}
      style={{ aspectRatio: `${template.imageWidth} / ${template.imageHeight}` }}
    >
      <Image
        src={template.imageUrl}
        alt={template.title}
        fill
        sizes={sizes}
        className="object-contain"
      />

      {template.slots.map((slot, index) => (
        <span
          key={index}
          className="absolute flex items-center justify-center border border-dashed border-white/70 bg-black/20 text-[11px] font-bold text-white"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.width}%`,
            height: `${slot.height}%`,
            transform: `rotate(${slot.rotation}deg)`,
          }}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}
