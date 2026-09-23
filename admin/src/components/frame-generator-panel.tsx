'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TemplateSource } from '@picky/collage';
import {
  DEFAULT_FRAME_OPTIONS,
  buildLayout,
  drawFrameTemplate,
  layoutToSlots,
  type FrameOptions,
} from '@picky/collage';
import { CARD, LABEL, Range } from '@/components/lab-ui';

const RESOLUTIONS = [1080, 1440, 2048];

/**
 * 프레임을 직접 그려 템플릿을 만드는 패널.
 * 좌표를 그리기 전에 알고 있으므로 검출을 거치지 않는다 — 워터마크나 라이선스 문제도 없다.
 */
export function FrameGeneratorPanel({
  onChange,
}: {
  onChange: (source: TemplateSource | null) => void;
}) {
  const [options, setOptions] = useState<FrameOptions>(DEFAULT_FRAME_OPTIONS);

  const source = useMemo<TemplateSource | null>(() => {
    const layout = buildLayout(options);
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    drawFrameTemplate(ctx, layout, options);
    return {
      name: `frames-${options.arrangement}-${options.count}`,
      width: options.width,
      height: options.height,
      layer: canvas,
      slots: layoutToSlots(layout, options),
    };
  }, [options]);

  useEffect(() => {
    onChange(source);
  }, [source, onChange]);

  function patch(next: Partial<FrameOptions>) {
    setOptions((current) => ({ ...current, ...next }));
  }

  /** 해상도만 바꾼다 — 가로세로 비율은 유지한다 */
  function setResolution(width: number) {
    const aspect = options.height / options.width;
    patch({ width, height: Math.round(width * aspect) });
  }

  return (
    <>
      <div className={CARD}>
        <span className={LABEL}>캔버스</span>

        <div className="mt-3">
          <span className="text-sm font-medium">해상도 (가로)</span>
          <div className="mt-1 flex gap-2">
            {RESOLUTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setResolution(value)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  options.width === value
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600'
                    : 'border-line hover:bg-gray-50'
                }`}
              >
                {value}px
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-sub">
            {options.width} × {options.height}
          </p>
        </div>

        <div className="mt-3">
          <span className="text-sm font-medium">배경</span>
          <div className="mt-1 flex gap-2">
            {(['white', 'transparent'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => patch({ background: value })}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  options.background === value
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600'
                    : 'border-line hover:bg-gray-50'
                }`}
              >
                {value === 'white' ? '흰색' : '투명'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={CARD}>
        <span className={LABEL}>배치</span>

        <div className="mt-2 flex gap-2">
          {(['diagonal', 'grid'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => patch({ arrangement: value })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                options.arrangement === value
                  ? 'border-brand-500 bg-brand-500/10 text-brand-600'
                  : 'border-line hover:bg-gray-50'
              }`}
            >
              {value === 'diagonal' ? '지그재그' : '격자'}
            </button>
          ))}
        </div>

        <Range
          label="칸 수"
          min={1}
          max={6}
          step={1}
          value={options.count}
          format={(v) => `${v}칸`}
          onChange={(count) => patch({ count })}
        />
        <Range
          label="프레임 크기"
          hint="캔버스 폭 대비"
          min={0.15}
          max={0.8}
          step={0.01}
          value={options.frameWidth}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(frameWidth) => patch({ frameWidth })}
        />
        <Range
          label="세로 비율"
          min={0.8}
          max={1.4}
          step={0.01}
          value={options.frameRatio}
          format={(v) => v.toFixed(2)}
          onChange={(frameRatio) => patch({ frameRatio })}
        />
        <Range
          label="기울기"
          hint="프레임마다 번갈아 기울어집니다"
          min={0}
          max={35}
          step={1}
          value={options.angleSpread}
          format={(v) => `±${v}°`}
          onChange={(angleSpread) => patch({ angleSpread })}
        />
        <Range
          label="겹침"
          min={0}
          max={0.45}
          step={0.01}
          value={options.overlap}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(overlap) => patch({ overlap })}
        />
      </div>

      <div className={CARD}>
        <span className={LABEL}>프레임 모양</span>

        <Range
          label="테두리"
          hint="좌·우·상단 흰 여백"
          min={0.02}
          max={0.14}
          step={0.005}
          value={options.border}
          format={(v) => `${(v * 100).toFixed(1)}%`}
          onChange={(border) => patch({ border })}
        />
        <Range
          label="하단 테두리"
          hint="폴라로이드는 아래가 두껍습니다"
          min={0.02}
          max={0.35}
          step={0.005}
          value={options.bottomBorder}
          format={(v) => `${(v * 100).toFixed(1)}%`}
          onChange={(bottomBorder) => patch({ bottomBorder })}
        />
        <Range
          label="그림자"
          min={0}
          max={0.5}
          step={0.02}
          value={options.shadowAlpha}
          format={(v) => v.toFixed(2)}
          onChange={(shadowAlpha) => patch({ shadowAlpha })}
        />
      </div>
    </>
  );
}
