'use client';

/** 콜라주 실험실에서 패널들이 함께 쓰는 조각들 */

export const CARD = 'rounded-xl border border-line bg-white p-4';
export const LABEL = 'text-xs font-medium text-ink-sub';

export function Range({
  label,
  hint,
  min,
  max,
  step,
  value,
  format = (v) => String(v),
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-ink-sub">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-brand-500"
      />
      {hint && <p className="text-xs text-ink-sub">{hint}</p>}
    </div>
  );
}

export function Preview({
  title,
  hint,
  empty,
  emptyText,
  canvasRef,
  className,
}: {
  title: string;
  hint: string;
  empty: boolean;
  emptyText: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** 바깥에서 높이를 잡아 줄 때 쓴다 (예: 화면 높이를 둘로 나눠 쓰는 미리보기) */
  className?: string;
}) {
  return (
    <div className={`${CARD} flex min-h-0 flex-col overflow-hidden ${className ?? ''}`}>
      <span className="text-sm font-semibold">{title}</span>
      <p className="mt-1 text-xs text-ink-sub">{hint}</p>

      {/* 남은 높이를 모두 차지한다. 캔버스는 그 안에 절대 배치한 칸에 넣어야 `max-h-full` 이
          늘어난 높이를 기준으로 계산된다 — 그냥 두면 원본 비율대로 커져 화면 밖으로 넘친다. */}
      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-[repeating-conic-gradient(#f3f4f6_0_25%,#ffffff_0_50%)] bg-[length:16px_16px]">
        <div className="absolute inset-0 flex items-center justify-center p-1">
          {/* 언마운트하면 ref 가 끊겨 다시 그릴 수 없으므로 투명도로만 감춘다 */}
          <canvas
            ref={canvasRef}
            className={`block max-h-full max-w-full ${empty ? 'opacity-0' : ''}`}
          />
        </div>
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink-sub">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}
