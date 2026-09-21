'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  STICKER_STATUSES,
  STICKER_STATUS_LABELS,
  type AdminStickerTemplate,
  type StickerImageUpload,
  type StickerTemplateStatus,
} from '@/lib/sticker-templates';
import { cn } from '@/lib/utils';

/** 업로드가 끝난 템플릿 이미지 — 경로는 저장에, URL·크기는 미리보기에 쓴다 */
type TemplateImage = {
  path: string;
  url: string;
  width: number;
  height: number;
};

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 스티커 템플릿 등록/수정 폼 — 템플릿은 이미지 한 장이 전부다.
 * 사진을 어디에 끼워 넣을지는 앱에서 사용자가 정하므로 여기서 영역을 지정하지 않는다.
 *
 * template 이 있으면 수정 모드(PATCH + 삭제 버튼), 없으면 등록 모드(POST).
 * 저장/취소 후 동작은 호출하는 쪽이 정한다 — 모달에서는 닫고 목록을 갱신하고,
 * 콜백이 없으면(페이지로 쓸 때) 목록 화면으로 이동한다.
 */
export function StickerTemplateForm({
  template,
  framed = true,
  onDone,
  onCancel,
}: {
  template?: AdminStickerTemplate;
  /** 카드 테두리 — 모달 안에서는 이미 테두리가 있으므로 false */
  framed?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(template?.title ?? '');
  const [status, setStatus] = useState<StickerTemplateStatus>(template?.status ?? 'PUBLISHED');
  const [image, setImage] = useState<TemplateImage | null>(
    template
      ? {
          path: template.imagePath,
          url: template.imageUrl,
          width: template.imageWidth,
          height: template.imageHeight,
        }
      : null,
  );

  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(template);
  const busy = uploading || pending !== null;

  function done() {
    if (onDone) {
      onDone();
      return;
    }
    router.push('/stickers');
    router.refresh();
  }

  function cancel() {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push('/stickers');
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      // 원본 크기는 브라우저가 이미 알고 있다 — 서버에 이미지 디코더를 두지 않기 위해
      // 여기서 읽어 저장 요청에 함께 보낸다.
      const size = await readImageSize(file);

      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/sticker-templates/image', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res));

      const uploaded = (await res.json()) as StickerImageUpload;
      setImage({ ...uploaded, ...size });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      // 같은 파일을 다시 고를 수 있도록 입력값을 비운다.
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!image) {
      setError('템플릿 이미지를 올려 주세요.');
      return;
    }

    setPending('save');
    setError(null);

    const body = {
      title: title.trim(),
      status,
      imagePath: image.path,
      imageWidth: image.width,
      imageHeight: image.height,
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/sticker-templates/${template!.id}` : '/api/admin/sticker-templates',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await readError(res));

      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!template) return;
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
        'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6',
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
            공개 상태만 앱 스티커 시트에 보입니다. 노출 순서는 목록에서 드래그로 바꿉니다.
          </p>
        </div>

        <div>
          <span className={LABEL}>템플릿 이미지</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            disabled={busy}
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
          />
          <p className="mt-1 text-xs text-ink-sub">PNG · JPG · WebP, 5MB 이하.</p>
        </div>

        {error && <p className="whitespace-pre-line text-sm text-brand-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {pending === 'save' ? '저장 중…' : editing ? '수정' : '등록'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="h-10 rounded-lg border border-line bg-white px-5 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60"
          >
            취소
          </button>
          {editing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="ml-auto h-10 rounded-lg border border-line bg-white px-5 text-sm text-brand-600 hover:bg-brand-500/5 disabled:opacity-60"
            >
              {pending === 'delete' ? '삭제 중…' : '삭제'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <span className={LABEL}>미리보기</span>

        {/* flex-1 로 좌측 입력 높이를 그대로 채운다. 투명 PNG 가 흰 배경에 묻히지
            않도록 체커보드를 깔고, 이미지는 비율을 지켜 안쪽에 맞춘다. */}
        <div className="relative mt-1 min-h-72 flex-1 overflow-hidden rounded-xl border border-line bg-[repeating-conic-gradient(#f3f4f6_0_25%,#ffffff_0_50%)] bg-[length:16px_16px]">
          {image && (
            <Image
              src={image.url}
              alt="템플릿 미리보기"
              fill
              sizes="448px"
              unoptimized
              className="object-contain p-2"
            />
          )}

          {!image && (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink-sub">
              {uploading ? '올리는 중…' : '이미지를 올리면 여기에 보입니다.'}
            </p>
          )}
        </div>

        {/* 높이를 늘 차지하게 두어 이미지를 바꿀 때 미리보기가 위아래로 움직이지 않게 한다 */}
        <p className="mt-2 h-4 text-center text-xs text-ink-sub">
          {image && !uploading && `${image.width} × ${image.height}`}
        </p>
      </div>
    </form>
  );
}

/** 업로드 전에 원본 픽셀 크기를 읽는다 — 목록·미리보기 비율의 기준이 된다 */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    image.src = url;
  });
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
