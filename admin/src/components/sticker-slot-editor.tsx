'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import {
  MAX_SLOTS,
  MIN_SLOT_SIZE,
  clamp,
  roundSlotValue,
  type StickerSlot,
} from '@/lib/sticker-templates';
import { cn } from '@/lib/utils';

type Props = {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  slots: StickerSlot[];
  onChange: (slots: StickerSlot[]) => void;
};

/** 드래그 중인 동작. draw 는 아직 slots 에 없는 새 칸을 그리는 중이다 */
type Drag =
  | { mode: 'draw'; originX: number; originY: number; current: StickerSlot }
  | { mode: 'move'; index: number; startX: number; startY: number; origin: StickerSlot }
  | { mode: 'resize'; index: number; startX: number; startY: number; origin: StickerSlot };

const NUDGE = 0.5;

/**
 * 템플릿 이미지 위에 사진 칸을 배치하는 에디터.
 *
 * 빈 곳을 드래그하면 칸이 하나 생기고, 생긴 순서가 곧 사진 번호가 된다
 * (1번 칸에 첫 번째 사진이 들어간다). 번호를 바꾸려면 아래 목록에서 순서를 옮긴다.
 */
export function StickerSlotEditor({
  imageUrl,
  imageWidth,
  imageHeight,
  slots,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const full = slots.length >= MAX_SLOTS;

  /** 포인터 좌표를 캔버스 대비 % 로 바꾼다 (캔버스 비율 = 이미지 비율이라 그대로 대응된다) */
  function toPercent(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function updateSlot(index: number, patch: Partial<StickerSlot>) {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // 칸이나 핸들에서 시작한 드래그는 각자 처리한다.
    if (event.target !== event.currentTarget) return;
    if (full) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = toPercent(event);
    setSelected(null);
    setDrag({
      mode: 'draw',
      originX: x,
      originY: y,
      current: { x, y, width: 0, height: 0, rotation: 0 },
    });
  }

  function handleSlotPointerDown(
    event: React.PointerEvent<HTMLElement>,
    index: number,
    mode: 'move' | 'resize',
  ) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = toPercent(event);
    setSelected(index);
    setDrag({ mode, index, startX: x, startY: y, origin: slots[index] });
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!drag) return;
    const { x, y } = toPercent(event);

    if (drag.mode === 'draw') {
      setDrag({
        ...drag,
        current: {
          x: Math.min(drag.originX, x),
          y: Math.min(drag.originY, y),
          width: Math.abs(x - drag.originX),
          height: Math.abs(y - drag.originY),
          rotation: 0,
        },
      });
      return;
    }

    const dx = x - drag.startX;
    const dy = y - drag.startY;

    if (drag.mode === 'move') {
      // 이동은 회전과 무관하다 — 회전축(중심)이 함께 움직일 뿐이다.
      updateSlot(drag.index, {
        x: roundSlotValue(clamp(drag.origin.x + dx, -50, 150)),
        y: roundSlotValue(clamp(drag.origin.y + dy, -50, 150)),
      });
      return;
    }

    // 크기 조절은 회전된 칸의 가로/세로 축을 따라야 한다. CSS rotate 는 픽셀 공간에서
    // 도므로 % 델타를 픽셀로 바꿔 -rotation 만큼 돌린 뒤 다시 % 로 되돌린다.
    const local = toLocalDelta(dx, dy, drag.origin.rotation, canvasRef.current);
    updateSlot(drag.index, {
      width: roundSlotValue(clamp(drag.origin.width + local.dx, MIN_SLOT_SIZE, 150)),
      height: roundSlotValue(clamp(drag.origin.height + local.dy, MIN_SLOT_SIZE, 150)),
    });
  }

  function handlePointerUp() {
    if (drag?.mode === 'draw') {
      const { current } = drag;
      // 클릭만 한 경우(점 하나)는 칸을 만들지 않는다.
      if (current.width >= MIN_SLOT_SIZE && current.height >= MIN_SLOT_SIZE) {
        onChange([
          ...slots,
          {
            x: roundSlotValue(current.x),
            y: roundSlotValue(current.y),
            width: roundSlotValue(current.width),
            height: roundSlotValue(current.height),
            rotation: 0,
          },
        ]);
        setSelected(slots.length);
      }
    }
    setDrag(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    const next = [...slots];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setSelected(target);
  }

  function remove(index: number) {
    onChange(slots.filter((_, i) => i !== index));
    setSelected(null);
  }

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = ARROW_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    const slot = slots[index];
    updateSlot(index, {
      x: roundSlotValue(clamp(slot.x + delta[0] * NUDGE, -50, 150)),
      y: roundSlotValue(clamp(slot.y + delta[1] * NUDGE, -50, 150)),
    });
  }

  const drawing = drag?.mode === 'draw' ? drag.current : null;

  return (
    <div className="space-y-3">
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          'relative w-full touch-none select-none overflow-hidden rounded-xl border border-line bg-[repeating-conic-gradient(#f3f4f6_0_25%,#ffffff_0_50%)] bg-[length:16px_16px]',
          full ? 'cursor-default' : 'cursor-crosshair',
        )}
        style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
      >
        {/* 이미지는 포인터를 받지 않아야 빈 곳 드래그가 캔버스로 전달된다 */}
        <Image
          src={imageUrl}
          alt="템플릿 이미지"
          fill
          sizes="640px"
          unoptimized
          draggable={false}
          className="pointer-events-none object-contain"
        />

        {slots.map((slot, index) => {
          const active = selected === index;
          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`${index + 1}번 사진 칸`}
              onPointerDown={(event) => handleSlotPointerDown(event, index, 'move')}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'absolute cursor-move border-2',
                active
                  ? 'border-brand-500 bg-brand-500/25'
                  : 'border-white/80 bg-black/25 hover:bg-black/15',
              )}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
                transform: `rotate(${slot.rotation}deg)`,
              }}
            >
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 px-2 py-0.5 text-xs font-bold text-white shadow">
                {index + 1}
              </span>

              <span
                role="button"
                tabIndex={-1}
                aria-label={`${index + 1}번 칸 크기 조절`}
                onPointerDown={(event) => handleSlotPointerDown(event, index, 'resize')}
                className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize rounded-full border-2 border-brand-500 bg-white"
              />
            </div>
          );
        })}

        {drawing && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-brand-500 bg-brand-500/20"
            style={{
              left: `${drawing.x}%`,
              top: `${drawing.y}%`,
              width: `${drawing.width}%`,
              height: `${drawing.height}%`,
            }}
          />
        )}
      </div>

      <p className="text-xs text-ink-sub">
        빈 곳을 드래그해 사진 칸을 만듭니다. 만든 순서가 곧 사진 번호이고, 앱에서 고른 사진이 그
        번호대로 채워집니다. 칸을 끌면 이동, 오른쪽 아래 점을 끌면 크기 조절, 방향키로 미세
        조정합니다.
        {full && <span className="ml-1 text-brand-600">칸은 최대 {MAX_SLOTS}개까지입니다.</span>}
      </p>

      {slots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-sub">
          아직 사진 칸이 없습니다. 위 이미지에서 사진이 들어갈 영역을 드래그해 주세요.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {slots.map((slot, index) => (
            <li
              key={index}
              className={cn('flex flex-wrap items-center gap-2 p-2', selected === index && 'bg-brand-500/5')}
            >
              <button
                type="button"
                onClick={() => setSelected(index)}
                className="flex size-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white"
              >
                {index + 1}
              </button>

              {SLOT_FIELDS.map(({ key, label, min, max }) => (
                <label key={key} className="flex items-center gap-1 text-xs text-ink-sub">
                  {label}
                  <input
                    type="number"
                    value={slot[key]}
                    min={min}
                    max={max}
                    step={0.5}
                    onFocus={() => setSelected(index)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isNaN(value)) return;
                      updateSlot(index, { [key]: roundSlotValue(clamp(value, min, max)) });
                    }}
                    className="w-16 rounded border border-line px-1.5 py-1 text-right text-xs text-ink outline-none focus:border-brand-500"
                  />
                </label>
              ))}

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`${index + 1}번 칸을 앞 번호로`}
                  className="size-7 rounded border border-line text-xs hover:bg-gray-100 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === slots.length - 1}
                  aria-label={`${index + 1}번 칸을 뒤 번호로`}
                  className="size-7 rounded border border-line text-xs hover:bg-gray-100 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`${index + 1}번 칸 삭제`}
                  className="size-7 rounded border border-line text-xs text-brand-600 hover:bg-brand-500/5"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SLOT_FIELDS = [
  { key: 'x', label: 'X', min: -50, max: 150 },
  { key: 'y', label: 'Y', min: -50, max: 150 },
  { key: 'width', label: 'W', min: MIN_SLOT_SIZE, max: 150 },
  { key: 'height', label: 'H', min: MIN_SLOT_SIZE, max: 150 },
  { key: 'rotation', label: '°', min: -180, max: 180 },
] as const satisfies readonly { key: keyof StickerSlot; label: string; min: number; max: number }[];

const ARROW_DELTAS: Record<string, [number, number] | undefined> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * 캔버스 기준 % 델타를 회전된 칸의 가로/세로 축 기준 % 델타로 바꾼다.
 * x 와 y 의 % 기준 길이가 다르므로(가로·세로 픽셀 수가 달라서) 픽셀로 바꿔 돌린 뒤 되돌린다.
 */
function toLocalDelta(dx: number, dy: number, rotation: number, canvas: HTMLElement | null) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect || rotation === 0) return { dx, dy };

  const pxX = (dx * rect.width) / 100;
  const pxY = (dy * rect.height) / 100;
  const rad = (-rotation * Math.PI) / 180;
  const localX = pxX * Math.cos(rad) - pxY * Math.sin(rad);
  const localY = pxX * Math.sin(rad) + pxY * Math.cos(rad);

  return { dx: (localX / rect.width) * 100, dy: (localY / rect.height) * 100 };
}
