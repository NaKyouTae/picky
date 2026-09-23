'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  STICKER_IMAGE_MAX_BYTES,
  STICKER_IMAGE_MIME,
  STICKER_PRICINGS,
  STICKER_PRICING_LABELS,
  STICKER_STATUSES,
  STICKER_STATUS_LABELS,
  toPricing,
  type AdminStickerTemplate,
  type StickerImageUpload,
  type StickerTemplatePricing,
  type StickerTemplateStatus,
} from '@/lib/sticker-templates';
import { cn } from '@/lib/utils';

/** 새로 고른 샘플 이미지 — 저장 전까지는 브라우저 안에만 있다 (objectURL 로 미리 본다) */
type Sample = {
  file: File;
  url: string;
  width: number;
  height: number;
};

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/** 샘플이 템플릿과 다른 비율이면 앱 카드에서 여백이 생긴다 — 이 정도 차이부터 알려준다 */
const RATIO_TOLERANCE = 0.02;

/**
 * 콜라주 템플릿 **수정** 폼 — 제목·공개 상태·유료 여부를 바꾸고, 고객에게 보여 줄
 * 샘플 이미지를 올리고, 삭제할 수 있다.
 *
 * 등록은 여기서 하지 않는다. 이미지와 칸(slots)은 콜라주 실험실에서 함께 정해지고,
 * 칸 없이 만든 템플릿은 서버가 거부하며(slots 필수) 앱 목록에도 나오지 않는다.
 *
 * 저장·취소·삭제 후 동작은 호출하는 쪽이 정한다 — 목록 모달에서는 닫고 목록을 갱신한다.
 */
export function StickerTemplateForm({
  template,
  framed = true,
  onDone,
  onCancel,
}: {
  template: AdminStickerTemplate;
  /** 카드 테두리 — 모달 안에서는 이미 테두리가 있으므로 false */
  framed?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(template.title);
  const [status, setStatus] = useState<StickerTemplateStatus>(template.status);
  // 유료/무료는 라디오 두 개보다 select 가 상태 필드와 나란히 읽힌다.
  const [pricing, setPricing] = useState<StickerTemplatePricing>(toPricing(template.isPaid));
  /** 새로 고른 샘플 (null 이면 저장된 그림을 그대로 둔다) */
  const [sample, setSample] = useState<Sample | null>(null);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // objectURL 은 직접 놓아야 한다. sample 이 바뀌면 직전 것을, 언마운트되면 지금 것을 놓는다.
  useEffect(() => {
    if (!sample) return;
    return () => URL.revokeObjectURL(sample.url);
  }, [sample]);

  const busy = pending !== null;

  // 미리보기에 보이는 그림 — 새로 고른 샘플이 있으면 그쪽이 먼저다.
  // 저장된 미리보기가 없는 옛 템플릿은 합성용 레이어(imageUrl)를 대신 본다 (앱도 같은 규칙).
  const shown = sample ?? {
    url: template.previewImageUrl ?? template.imageUrl,
    width: template.imageWidth,
    height: template.imageHeight,
  };

  // 앱 카드는 비율을 지켜 줄여 넣으므로, 비율이 다르면 위아래(또는 좌우)에 빈 자리가 생긴다.
  const templateRatio = template.imageWidth / template.imageHeight;
  const ratioOff =
    sample !== null &&
    Math.abs(sample.width / sample.height - templateRatio) / templateRatio > RATIO_TOLERANCE;

  function done() {
    if (onDone) {
      onDone();
      return;
    }
    router.push('/collages');
    router.refresh();
  }

  function cancel() {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push('/collages');
  }

  /** 파일을 고르면 크기만 읽어 두고 화면에 띄운다 — 업로드는 '수정'을 누를 때 한다 */
  async function pickSample(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 고를 수 있도록 값을 비운다 (지우고 되돌린 뒤 같은 파일을 고르는 경우).
    event.target.value = '';
    if (!file) return;

    if (!STICKER_IMAGE_MIME.includes(file.type)) {
      setError('샘플 이미지는 PNG · JPG · WebP 만 올릴 수 있습니다.');
      return;
    }
    if (file.size > STICKER_IMAGE_MAX_BYTES) {
      setError('샘플 이미지는 5MB 이하만 올릴 수 있습니다.');
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const { width, height } = await readSize(url);
      setError(null);
      setSample({ file, url, width, height });
    } catch {
      URL.revokeObjectURL(url);
      setError('이미지를 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setPending('save');
    setError(null);

    try {
      // 샘플을 고른 경우에만 Storage 에 올린다. 저장에 실패하면 파일만 남으므로
      // 순서를 뒤집지 않는다 (먼저 올리고, 경로를 붙여 한 번에 저장한다).
      const uploaded = sample ? await uploadSample(sample.file) : null;

      const body = {
        title: title.trim(),
        status,
        isPaid: pricing === 'PAID',
        // 이미지와 칸은 실험실에서 정해진 그대로 둔다 — 여기서는 바꾸지 않는다.
        imagePath: template.imagePath,
        imageWidth: template.imageWidth,
        imageHeight: template.imageHeight,
        ...(uploaded ? { previewImagePath: uploaded.path } : {}),
      };

      const res = await fetch(`/api/admin/sticker-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res));

      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm('이 템플릿을 삭제할까요? 이미지도 함께 지워지며 되돌릴 수 없습니다.')) {
      return;
    }

    setPending('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/sticker-templates/${template.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));

      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      setPending(null);
    }
  }

  return (
    // 좌: 입력 1열 / 우: 미리보기. 그리드 항목은 기본이 stretch 라 우측 미리보기가
    // 좌측 입력 높이만큼 늘어난다(= 세로로 길게).
    <form
      onSubmit={handleSubmit}
      className={cn(
        'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        framed && 'max-w-4xl rounded-xl border border-line bg-white p-6',
      )}
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="title" className={LABEL}>
            제목
          </label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="폴라로이드 4컷"
            required
            minLength={2}
            maxLength={120}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="status" className={LABEL}>
            상태
          </label>
          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StickerTemplateStatus)}
            className={FIELD}
          >
            {STICKER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STICKER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-sub">
            공개 상태만 앱 콜라주 화면에 보입니다. 노출 순서는 목록에서 드래그로 바꿉니다.
          </p>
        </div>

        <div>
          <label htmlFor="pricing" className={LABEL}>
            이용 조건
          </label>
          <select
            id="pricing"
            value={pricing}
            onChange={(event) => setPricing(event.target.value as StickerTemplatePricing)}
            className={FIELD}
          >
            {STICKER_PRICINGS.map((value) => (
              <option key={value} value={value}>
                {STICKER_PRICING_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-sub">
            유료 템플릿은 앱 목록에는 보이되 결제한 사용자만 쓸 수 있습니다.
          </p>
        </div>

        <div>
          <span className={LABEL}>사진 자리</span>
          <p className="mt-1 text-sm">{template.slotCount}칸</p>
          {/* 칸 좌표는 이 이미지의 배치에 묶여 있다. 이미지만 바꾸면 사진이 엉뚱한 자리에
              들어가므로 여기서는 교체할 수 없게 하고, 콜라주 실험실에서 새로 등록하게 한다. */}
          <p className="mt-1 text-xs text-ink-sub">
            이미지와 칸은 함께 정해집니다. 바꾸려면{' '}
            <Link href="/collage-lab" className="font-medium text-ink underline">
              콜라주 실험실
            </Link>
            에서 새로 등록하고 이 템플릿은 보관 처리해 주세요.
          </p>
        </div>

        {error && <p className="whitespace-pre-line text-sm text-brand-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-brand-500 px-5 sm:h-10 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {pending === 'save' ? '저장 중…' : '수정'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="h-11 rounded-lg border border-line bg-white px-5 sm:h-10 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="ml-auto h-11 rounded-lg border border-line bg-white px-5 sm:h-10 text-sm text-brand-600 hover:bg-brand-500/5 disabled:opacity-60"
          >
            {pending === 'delete' ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <span className={LABEL}>고객에게 보여 줄 샘플</span>
        {/* 실험실이 만드는 그림은 칸을 회색으로 칠한 것뿐이라, 칸이 붙어 있으면 경계가
            보이지 않는다. 사진을 넣어 완성한 예시를 올려 두면 결과가 바로 전해진다. */}
        <p className="mt-1 text-xs text-ink-sub">
          앱 템플릿 선택 화면에 이 그림이 보입니다. 사진을 넣어 완성한 예시를 올리면 칸 배치가
          한눈에 보입니다.
        </p>

        {/* flex-1 로 좌측 입력 높이를 그대로 채운다. 투명 PNG 가 흰 배경에 묻히지
            않도록 체커보드를 깔고, 이미지는 비율을 지켜 안쪽에 맞춘다. */}
        <div className="relative mt-2 min-h-72 flex-1 overflow-hidden rounded-xl border border-line bg-[repeating-conic-gradient(#f3f4f6_0_25%,#ffffff_0_50%)] bg-[length:16px_16px]">
          {/* 고른 샘플은 blob: URL 이라 next/image 를 거치지 않는다 (최적화도 필요 없다) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown.url}
            alt={sample ? '고른 샘플 이미지' : '지금 앱에 보이는 그림'}
            className="absolute inset-0 size-full object-contain p-2"
          />
        </div>

        {/* 높이를 늘 차지하게 두어 이미지를 바꿀 때 미리보기가 위아래로 움직이지 않게 한다 */}
        <p className="mt-2 h-4 text-center text-xs text-ink-sub">
          {shown.width} × {shown.height}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* 파일 입력은 숨기고 label 을 버튼처럼 쓴다 — 브라우저 기본 모양이 폼과 어울리지 않는다 */}
          <label
            className={cn(
              'flex h-11 cursor-pointer items-center rounded-lg border border-line bg-white px-4 text-sm text-ink hover:bg-gray-100 sm:h-10',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            {sample ? '다른 이미지 고르기' : '샘플 이미지 올리기'}
            <input
              type="file"
              accept={STICKER_IMAGE_MIME.join(',')}
              onChange={pickSample}
              disabled={busy}
              className="sr-only"
            />
          </label>

          {sample && (
            <button
              type="button"
              onClick={() => setSample(null)}
              disabled={busy}
              className="h-11 rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60 sm:h-10"
            >
              되돌리기
            </button>
          )}
        </div>

        {sample && (
          <p className="mt-2 text-xs text-ink-sub">
            아직 저장되지 않았습니다 — <span className="font-medium text-ink">수정</span> 을 눌러야
            앱에 반영됩니다.
          </p>
        )}

        {ratioOff && (
          <p className="mt-1 text-xs text-brand-600">
            템플릿({template.imageWidth} × {template.imageHeight})과 비율이 달라 앱 카드에서
            위아래에 빈 자리가 생길 수 있습니다.
          </p>
        )}
      </div>
    </form>
  );
}

/** 고른 파일의 원본 픽셀 크기 — 미리보기 아래 표시와 비율 확인에 쓴다 */
function readSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    image.src = url;
  });
}

/** 샘플 이미지를 Storage 에 올리고 경로를 받는다 (템플릿 이미지와 같은 업로드 API) */
async function uploadSample(file: File): Promise<StickerImageUpload> {
  const body = new FormData();
  body.append('file', file);

  const res = await fetch('/api/admin/sticker-templates/image', {
    method: 'POST',
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as StickerImageUpload;
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
