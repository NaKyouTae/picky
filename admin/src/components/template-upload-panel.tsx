'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DETECT_OPTIONS,
  detectSlotsWithReport,
  punchSlots,
  type DetectOptions,
  type DetectReport,
  type TemplateSource,
} from '@picky/collage';
import { CARD, LABEL, Range } from '@/components/lab-ui';
import { rasterizeTemplate } from '@/lib/rasterize-template';

type Uploaded = {
  name: string;
  width: number;
  height: number;
  /** 검출용 원본 픽셀 — 임계값을 바꿀 때마다 여기서 다시 계산한다 */
  source: ImageData;
};

/**
 * 올린 이미지에서 검정 영역을 훑어 사진 자리를 찾는 로직.
 *
 * 이미지 선택 버튼(우측 상단)과 검출 조건(좌측)이 화면에서 떨어져 있어 상태를 훅으로 빼 두고,
 * 화면 조각들이 같은 상태를 나눠 쓴다.
 */
export function useTemplateDetection(onChange: (source: TemplateSource | null) => void) {
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [options, setOptions] = useState<DetectOptions>(DEFAULT_DETECT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detected = useMemo<{ source: TemplateSource; report: DetectReport } | null>(() => {
    if (!uploaded) return null;

    const canvas = document.createElement('canvas');
    canvas.width = uploaded.width;
    canvas.height = uploaded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 검출은 원본 픽셀로 먼저 한다 — 뚫을 자리를 알아야 그 안만 뚫을 수 있다.
    const { slots, report } = detectSlotsWithReport(
      uploaded.source.data,
      uploaded.width,
      uploaded.height,
      options,
    );

    // punchSlots 는 배열을 직접 고치므로 원본을 남겨 두고 복사본에 적용한다
    const copy = new ImageData(
      new Uint8ClampedArray(uploaded.source.data),
      uploaded.width,
      uploaded.height,
    );
    punchSlots(copy.data, uploaded.width, uploaded.height, slots, options.threshold);
    ctx.putImageData(copy, 0, 0);

    return {
      source: {
        name: uploaded.name,
        width: uploaded.width,
        height: uploaded.height,
        layer: canvas,
        slots,
      },
      report,
    };
  }, [uploaded, options]);

  const source = detected?.source ?? null;

  useEffect(() => {
    onChange(source);
  }, [source, onChange]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // SVG 는 벡터라 굽는 크기를 정해 줘야 한다 — rasterizeTemplate 이 형식별로 처리한다.
      const { width, height, data } = await rasterizeTemplate(file);
      setUploaded({ name: file.name, width, height, source: data });
    } catch {
      setError('템플릿을 읽지 못했습니다. PNG · SVG · JPG · WebP 파일인지 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { uploaded, options, setOptions, error, busy, handleFile, detected };
}

type Detection = ReturnType<typeof useTemplateDetection>;

/** 템플릿 이미지 가져오기 — 실험실 우측 상단에 놓는 버튼 하나 */
export function TemplateImagePicker({
  uploaded,
  error,
  busy,
  handleFile,
}: Pick<Detection, 'uploaded' | 'error' | 'busy' | 'handleFile'>) {
  return (
    <div className="flex items-center gap-3">
      {/* 파일 입력 기본 모양("파일 선택 / 선택된 파일 없음")은 어디를 눌러야 하는지 알기 어렵다.
          input 을 감춘 label 로 감싸 버튼처럼 보이게 한다 (칸별 사진 선택과 같은 방식). */}
      <label
        aria-disabled={busy}
        className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white ${
          busy ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:opacity-90'
        }`}
      >
        <UploadIcon />
        {busy ? '읽는 중…' : uploaded ? '다른 이미지 올리기' : '템플릿 이미지 가져오기'}
        <input
          type="file"
          accept="image/png,image/svg+xml,image/jpeg,image/webp"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            // 같은 파일을 다시 고를 수 있도록 값을 비운다
            event.target.value = '';
          }}
          className="hidden"
        />
      </label>

      <p className="min-w-0 truncate text-xs text-ink-sub">
        {error ? (
          <span className="text-brand-600">{error}</span>
        ) : uploaded ? (
          `${uploaded.name} · ${uploaded.width} × ${uploaded.height}`
        ) : (
          'PNG · SVG · JPG · WebP — 검정 영역이 사진 자리가 됩니다 (SVG 는 긴 변 1350px 로 구움)'
        )}
      </p>
    </div>
  );
}

/** 검출 조건 — 좌측 입력 묶음에 놓는다 */
export function TemplateDetectOptions({
  options,
  setOptions,
  detected,
}: Pick<Detection, 'options' | 'setOptions' | 'detected'>) {
  return (
    <div className={CARD}>
      <span className={LABEL}>검출 조건</span>

      <Range
        label="검정 임계값"
        hint="R·G·B 가 모두 이 값 이하면 사진 자리로 봅니다"
        min={0}
        max={120}
        step={5}
        value={options.threshold}
        onChange={(threshold) => setOptions((o) => ({ ...o, threshold }))}
      />
      <Range
        label="색 구분"
        hint="시작 픽셀과 이만큼 넘게 다른 색은 다른 칸으로 봅니다. 어두운 두 색(#121212·#1c1c1c)을 맞대어 칸을 나눌 때 8 정도로 둡니다"
        min={2}
        max={80}
        step={2}
        value={options.colorTolerance}
        onChange={(colorTolerance) => setOptions((o) => ({ ...o, colorTolerance }))}
      />
      <Range
        label="최소 면적"
        hint="전체 픽셀 대비. 작은 얼룩을 걸러냅니다"
        min={0.001}
        max={0.05}
        step={0.001}
        value={options.minAreaRatio}
        format={(v) => `${(v * 100).toFixed(1)}%`}
        onChange={(minAreaRatio) => setOptions((o) => ({ ...o, minAreaRatio }))}
      />
      <Range
        label="사각형 정도"
        hint="1 에 가까울수록 반듯한 사각형만 통과합니다"
        min={0.3}
        max={1}
        step={0.05}
        value={options.minFillRatio}
        format={(v) => v.toFixed(2)}
        onChange={(minFillRatio) => setOptions((o) => ({ ...o, minFillRatio }))}
      />

      {detected && <Diagnosis report={detected.report} found={detected.source.slots.length} />}
    </div>
  );
}

/**
 * 어느 조건이 칸을 걸러냈는지 알려 준다.
 * 조건 세 개가 모두 걸릴 수 있어, 0개로 나올 때 슬라이더만 보고는 원인을 알 수 없다.
 */
function Diagnosis({ report, found }: { report: DetectReport; found: number }) {
  const blackPercent = (report.blackRatio * 100).toFixed(1);
  const rejected = report.tooSmall + report.notRectangular;

  // 걸러진 덩어리가 있으면 얼마까지 내려야 통과하는지 계산해 둔다 (0.05 단위로 내림)
  const suggestion =
    report.bestRejectedFillRatio !== null
      ? Math.max(0.3, Math.floor(report.bestRejectedFillRatio * 20) / 20)
      : null;

  return (
    <div className="mt-4 border-t border-line pt-3 text-xs text-ink-sub">
      <p>
        검정으로 잡힌 픽셀 <span className="font-medium text-ink">{blackPercent}%</span>
        {report.tooSmall > 0 && ` · 너무 작아 버림 ${report.tooSmall}개`}
        {report.notRectangular > 0 && ` · 사각형 아님 ${report.notRectangular}개`}
      </p>

      {/* 하나도 못 찾았을 때뿐 아니라, 일부만 걸러졌을 때도 알려 준다.
          배경까지 사진 자리인 템플릿은 배경 한 칸만 걸러지는 경우가 흔하다. */}
      {(found === 0 || rejected > 0) && (
        <p className="mt-1 text-brand-600">
          {found === 0 && report.blackRatio < 0.01
            ? '검정으로 잡힌 픽셀이 거의 없습니다. 사진 자리가 순수 검정이 아닐 수 있으니 검정 임계값을 올려 보세요.'
            : report.notRectangular > 0 && suggestion !== null
              ? `${report.notRectangular}개가 사각형 조건에 막혔습니다. 사각형 정도를 ${suggestion.toFixed(2)} 이하로 내리면 잡힙니다.`
              : // 조각이 수백 개로 쏟아지면 면적이 아니라 색 구분이 너무 빡빡한 것이다.
                // (JPEG 노이즈가 낀 어두운 칸이 색 차이로 잘게 갈라진 경우)
                report.tooSmall > 50
                ? `${report.tooSmall}개로 잘게 갈라졌습니다. 색 구분이 너무 빡빡할 수 있으니 값을 올려 보세요.`
                : report.tooSmall > 0
                  ? `${report.tooSmall}개가 최소 면적보다 작아 버려졌습니다. 최소 면적을 내려 보세요.`
                  : '사진 자리를 찾지 못했습니다. 검정 임계값을 올려 보세요.'}
        </p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
