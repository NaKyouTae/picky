import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { StickerSlot } from '@/lib/sticker-templates';

type Props = {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  slots: StickerSlot[];
  /** 칸 위에 번호를 찍을지 — 목록 썸네일처럼 작을 때는 끈다 */
  showNumbers?: boolean;
  className?: string;
  sizes?: string;
};

/**
 * 템플릿 + 사진 칸 미리보기 (읽기 전용).
 *
 * 앱에서 합성할 때와 같은 순서로 그린다 — 템플릿을 깔고 그 위에 사진 칸을 올린다.
 * 칸 좌표가 % 라서 어떤 크기로 줄여도 같은 그림이 나온다.
 */
export function StickerPreview({
  imageUrl,
  imageWidth,
  imageHeight,
  slots,
  showNumbers = true,
  className,
  sizes = '320px',
}: Props) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-lg bg-gray-100', className)}
      style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
    >
      <Image src={imageUrl} alt="" fill sizes={sizes} className="object-contain" unoptimized />

      {slots.map((slot, index) => (
        <div
          key={index}
          className="absolute flex items-center justify-center border border-brand-500/70 bg-brand-500/15"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.width}%`,
            height: `${slot.height}%`,
            transform: `rotate(${slot.rotation}deg)`,
          }}
        >
          {showNumbers && (
            <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white">
              {index + 1}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
