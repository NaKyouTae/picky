'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  coverCrop,
  drawCollage,
  drawSlotOutlines,
  type SlotFill,
  type TemplateSource,
} from '@picky/collage';
import {
  TemplateDetectOptions,
  TemplateImagePicker,
  useTemplateDetection,
} from '@/components/template-upload-panel';
import { CARD, LABEL, Preview } from '@/components/lab-ui';
import type { StickerImageUpload } from '@/lib/sticker-templates';

type Photo = {
  name: string;
  /** 합성용 — EXIF 회전을 적용해 디코드한 비트맵 */
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** 썸네일 표시용 objectURL. 놓을 때 revoke 해야 한다 */
  url: string;
};

/** 미리보기 캔버스 가로 상한 — 원본이 2048px 이어도 화면에는 이 크기로 그린다 */
const PREVIEW_WIDTH = 900;

/** 비트맵과 objectURL 을 함께 놓아준다 — 안 하면 큰 사진에서 메모리가 쌓인다 */
function release(photo: Photo | null) {
  if (!photo) return;
  photo.bitmap.close();
  URL.revokeObjectURL(photo.url);
}

/** 서버가 준 메시지를 그대로 보여준다 — 5MB 초과·검증 실패 같은 이유가 담겨 있다 */
/**
 * 고객용 미리보기 PNG.
 *
 * 등록되는 템플릿 이미지는 **사진 자리가 뚫린 합성용 레이어**라, 칸이 화면 전체를 덮는
 * 템플릿은 전부 투명한 PNG 가 된다. 그대로 앱의 템플릿 선택 화면에 쓰면 빈 카드로 보인다.
 * 그래서 흰 바탕에 칸을 회색으로 채우고 레이어를 덮어, 배치가 한눈에 보이는 그림을 만든다.
 */
async function renderPreview(source: TemplateSource): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 를 만들 수 없습니다.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, source.width, source.height);

  // 사진이 들어갈 자리 — 실제 합성과 같은 위치·각도로 채운다
  ctx.fillStyle = '#d7dbe0';
  for (const slot of source.slots) {
    ctx.save();
    ctx.translate(slot.cx, slot.cy);
    ctx.rotate(slot.angle);
    ctx.fillRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h);
    ctx.restore();
  }

  ctx.drawImage(source.layer, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('미리보기를 만들지 못했습니다.');
  return blob;
}

/** Storage 에 한 장 올리고 경로를 받는다 */
async function uploadImage(blob: Blob, name: string): Promise<StickerImageUpload> {
  const body = new FormData();
  body.append('file', new File([blob], name, { type: 'image/png' }));

  const res = await fetch('/api/admin/sticker-templates/image', {
    method: 'POST',
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await readMessage(res));
  return (await res.json()) as StickerImageUpload;
}

async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    return message ?? '등록하지 못했습니다.';
  } catch {
    return '등록하지 못했습니다.';
  }
}

async function loadPhoto(file: File): Promise<Photo> {
  // iOS 사진은 회전 정보가 EXIF 에 있어 이 옵션 없이 그리면 눕는다
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return {
    name: file.name,
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    url: URL.createObjectURL(file),
  };
}

export function CollageLab() {
  const [source, setSource] = useState<TemplateSource | null>(null);
  /** 칸 번호(0-based)별로 넣은 사진 */
  const [assigned, setAssigned] = useState<(Photo | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  // 이미지 선택 버튼은 우측 상단, 검출 조건은 좌측이라 상태를 여기서 들고 나눠 준다.
  const detection = useTemplateDetection(setSource);

  const templateCanvas = useRef<HTMLCanvasElement>(null);
  const resultCanvas = useRef<HTMLCanvasElement>(null);

  // 언마운트 시 남은 사진을 놓아준다. 최신 값을 ref 로 따라둔다.
  const assignedRef = useRef<(Photo | null)[]>([]);
  useEffect(() => {
    assignedRef.current = assigned;
  }, [assigned]);
  useEffect(() => () => assignedRef.current.forEach(release), []);

  // ?? [] 를 그대로 쓰면 매 렌더마다 새 배열이라 아래 useMemo 가 계속 다시 돈다
  const slots = useMemo(() => source?.slots ?? [], [source]);
  const previewScale = source ? Math.min(1, PREVIEW_WIDTH / source.width) : 1;

  const fills = useMemo<(SlotFill | null)[]>(
    () =>
      slots.map((slot, index) => {
        const photo = assigned[index];
        if (!photo) return null;
        return {
          photo: photo.bitmap,
          photoW: photo.width,
          photoH: photo.height,
          crop: coverCrop(slot.w, slot.h, photo.width, photo.height),
        };
      }),
    [slots, assigned],
  );

  const filledCount = fills.filter(Boolean).length;
  /**
   * 등록 가능 조건 — 칸을 모두 채워 합성 결과를 눈으로 확인했을 때만.
   * 검출이 어긋난 템플릿은 사진을 넣어 보면 바로 드러나므로, 이 확인을 등록의 전제로 둔다.
   */
  const tested = source !== null && slots.length > 0 && filledCount === slots.length;

  // 템플릿 — 뚫린 자리가 보이도록 회색을 깔고 그 위에 레이어와 칸 테두리를 그린다
  useEffect(() => {
    const canvas = templateCanvas.current;
    if (!canvas || !source) return;

    canvas.width = Math.round(source.width * previewScale);
    canvas.height = Math.round(source.height * previewScale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source.layer, 0, 0, canvas.width, canvas.height);
    drawSlotOutlines(ctx, source.slots, previewScale);
  }, [source, previewScale]);

  // 합성 결과
  useEffect(() => {
    const canvas = resultCanvas.current;
    if (!canvas || !source) return;

    canvas.width = Math.round(source.width * previewScale);
    canvas.height = Math.round(source.height * previewScale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawCollage(ctx, source.layer, source.width, source.height, source.slots, fills, previewScale);
  }, [source, fills, previewScale]);

  /** 한 칸에 사진 한 장 */
  const setSlotPhoto = useCallback(async (index: number, file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await loadPhoto(file);
      const previous = assignedRef.current[index] ?? null;
      setAssigned((current) => {
        const next = [...current];
        while (next.length <= index) next.push(null);
        next[index] = photo;
        return next;
      });
      release(previous);
    } catch {
      setError('사진을 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, []);

  const clearSlot = useCallback((index: number) => {
    const previous = assignedRef.current[index] ?? null;
    setAssigned((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
    release(previous);
  }, []);

  /** 여러 장을 한 번에 골라 1번 칸부터 순서대로 채운다 */
  const fillAll = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = await Promise.all(Array.from(files).map(loadPhoto));
      const previous = [...assignedRef.current];
      setAssigned(loaded);
      previous.forEach(release);
    } catch {
      setError('사진을 읽지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, []);

  /** 칸 순서를 한 칸 밀어 스왑 동작을 확인한다 */
  const rotate = useCallback(() => {
    setAssigned((current) => {
      if (current.length === 0) return current;
      const next = [...current];
      next.unshift(next.pop() ?? null);
      return next;
    });
  }, []);

  /**
   * 콜라주로 등록 — 템플릿 레이어를 Storage 에 올리고 칸 정보와 함께 저장한다.
   *
   * 사진을 모두 넣어 합성 결과를 확인했을 때만 부를 수 있다(아래 tested).
   * 확인하지 않은 템플릿이 등록되면 고객 화면에서 사진이 엉뚱한 자리에 들어간다.
   */
  async function register() {
    if (!source) return;

    setRegistering(true);
    setError(null);
    setRegistered(null);

    try {
      // 레이어를 원본 해상도 PNG 로 — 사진 자리가 투명해야 앱에서 사진 위에 덮을 수 있다
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 를 만들 수 없습니다.');
      ctx.drawImage(source.layer, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG 로 만들지 못했습니다.');

      // 고객용 미리보기 — 레이어만 올리면 칸이 화면 전체인 템플릿은 전부 투명한 PNG 라
      // 앱의 템플릿 선택 화면에서 빈 카드로 보인다. 칸을 채운 그림을 따로 만들어 둔다.
      const previewBlob = await renderPreview(source);

      const [image, preview] = await Promise.all([
        uploadImage(blob, `${source.name}.png`),
        uploadImage(previewBlob, `${source.name}-preview.png`),
      ]);

      const created = await fetch('/api/admin/sticker-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          imagePath: image.path,
          previewImagePath: preview.path,
          imageWidth: source.width,
          imageHeight: source.height,
          slots: source.slots.map(({ cx, cy, w, h, angle }) => ({ cx, cy, w, h, angle })),
          status: publishNow ? 'PUBLISHED' : 'DRAFT',
        }),
        cache: 'no-store',
      });
      if (!created.ok) throw new Error(await readMessage(created));

      setRegistered(title.trim());
      setTitle('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '등록하지 못했습니다.');
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <TemplateDetectOptions
          options={detection.options}
          setOptions={detection.setOptions}
          detected={detection.detected}
        />

        <div className={CARD}>
          <div className="flex items-baseline justify-between">
            <span className={LABEL}>칸마다 사진 넣기</span>
            <span className="text-xs text-ink-sub">
              {filledCount} / {slots.length}
            </span>
          </div>

          {slots.length === 0 ? (
            // 템플릿을 올렸는데도 0개면 검출이 실패한 것이다 — 올리라고 다시 안내하면 혼란스럽다.
            <p className="mt-2 text-xs text-ink-sub">
              {!source
                ? '템플릿을 먼저 올리면 칸이 여기에 나옵니다.'
                : '사진 자리를 찾지 못했습니다. 위 검출 조건을 조절해 주세요.'}
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {slots.map((slot, index) => {
                  const photo = assigned[index] ?? null;
                  return (
                    <li
                      key={`${index}-${Math.round(slot.cx)}-${Math.round(slot.cy)}`}
                      className="flex items-center gap-3 rounded-lg border border-line p-2"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                        {index + 1}
                      </span>

                      {/* 썸네일 자리를 늘 차지하게 두어 사진을 넣을 때 줄이 흔들리지 않게 한다 */}
                      <span className="size-12 shrink-0 overflow-hidden rounded bg-gray-100">
                        {photo && (
                          // 로컬 objectURL 이라 next/image 로 최적화할 대상이 아니다
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.url}
                            alt={`${index + 1}번 칸 사진`}
                            className="size-12 object-cover"
                          />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        {photo ? (
                          <>
                            <p className="truncate text-xs font-medium">{photo.name}</p>
                            <p className="text-[11px] text-ink-sub">
                              {photo.width} × {photo.height}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-ink-sub">비어 있음</p>
                        )}
                      </div>

                      <label className="shrink-0 cursor-pointer rounded-lg border border-line px-2 py-1 text-xs font-medium hover:bg-gray-50">
                        {photo ? '교체' : '사진 선택'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => void setSlotPhoto(index, event.target.files?.[0])}
                        />
                      </label>

                      {photo && (
                        <button
                          type="button"
                          onClick={() => clearSlot(index)}
                          aria-label={`${index + 1}번 칸 사진 지우기`}
                          className="shrink-0 rounded-lg px-2 py-1 text-xs text-ink-sub hover:bg-gray-100"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex gap-2">
                <label className="flex-1 cursor-pointer rounded-lg border border-line px-3 py-2 text-center text-xs font-medium hover:bg-gray-50">
                  여러 장 한 번에
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void fillAll(event.target.files)}
                  />
                </label>
                <button
                  type="button"
                  onClick={rotate}
                  disabled={filledCount === 0}
                  className="flex-1 rounded-lg border border-line px-3 py-2 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  한 칸 밀기
                </button>
              </div>
            </>
          )}
        </div>

        <div className={CARD}>
          <span className={LABEL}>콜라주로 등록</span>

          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="템플릿 제목 (예: 폴라로이드 4컷)"
            maxLength={120}
            className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm"
          />

          <label className="mt-2 flex items-center gap-2 text-xs text-ink-sub">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
              className="accent-brand-500"
            />
            바로 공개 (끄면 작성 중으로 등록됩니다)
          </label>

          <button
            type="button"
            onClick={() => void register()}
            disabled={!tested || title.trim().length < 2 || registering}
            className="mt-3 w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {registering ? '등록 중…' : '콜라주로 등록하기'}
          </button>

          {/* 왜 못 누르는지 알려준다 — 비활성 버튼만 두면 이유를 알 수 없다 */}
          <p className="mt-2 text-xs text-ink-sub">
            {!source
              ? '템플릿을 먼저 만들거나 올려 주세요.'
              : slots.length === 0
                ? '사진 자리가 하나도 검출되지 않았습니다.'
                : !tested
                  ? `${slots.length}개 칸을 모두 채워 합성 결과를 확인해야 등록할 수 있습니다 (지금 ${filledCount}개).`
                  : title.trim().length < 2
                    ? '제목을 2자 이상 입력해 주세요.'
                    : '확인이 끝났습니다. 등록할 수 있습니다.'}
          </p>

          {registered && (
            <p className="mt-2 text-xs text-ink">
              &ldquo;{registered}&rdquo; 등록됐습니다.{' '}
              <Link href="/collages" className="font-medium underline">
                콜라주 목록
              </Link>
              에서 확인하세요.
            </p>
          )}
        </div>

        {busy && <p className="text-sm text-ink-sub">읽는 중…</p>}
        {error && <p className="text-sm text-brand-600">{error}</p>}
      </div>

      {/* 화면 높이를 둘로 나눠 템플릿과 합성 결과를 한눈에 본다 — 미리보기 쪽은 스크롤하지 않는다.
          (lg 이상에서 레이아웃 패딩이 위아래 4rem, gap 1rem 을 뺀 높이) */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-[calc(100dvh-5rem)]">
        <TemplateImagePicker
          uploaded={detection.uploaded}
          error={detection.error}
          busy={detection.busy}
          handleFile={detection.handleFile}
        />

        <Preview
          className="flex-1"
          title="검출 결과"
          hint="회색으로 보이는 부분이 투명하게 뚫린 사진 자리입니다. 빨간 테두리와 번호가 그 자리를 가리킵니다."
          empty={!source}
          emptyText="템플릿을 올리면 여기에 보입니다."
          canvasRef={templateCanvas}
        />
        <Preview
          className="flex-1"
          title="합성 결과"
          hint="사진을 아래에 깔고 템플릿을 위에 덮은 결과입니다. 칸마다 사진이 꽉 차도록(cover) 잘라 넣습니다."
          empty={!source || filledCount === 0}
          emptyText={source ? '칸에 사진을 넣으면 여기에 보입니다.' : '템플릿을 먼저 만드세요.'}
          canvasRef={resultCanvas}
        />
      </div>
    </div>
  );
}
