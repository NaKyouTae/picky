'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { StickerSlotEditor } from '@/components/sticker-slot-editor';
import {
  STICKER_STATUSES,
  STICKER_STATUS_LABELS,
  type AdminStickerTemplate,
  type StickerImageUpload,
  type StickerSlot,
  type StickerTemplateStatus,
} from '@/lib/sticker-templates';
import { cn } from '@/lib/utils';

/** 업로드가 끝난 템플릿 이미지 — 경로는 저장에, URL·크기는 에디터에 쓴다 */
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
 * 스티커 템플릿 등록/수정 폼.
 * template 이 있으면 수정 모드(PATCH + 삭제 버튼), 없으면 등록 모드(POST).
 *
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
  const [displayOrder, setDisplayOrder] = useState(String(template?.displayOrder ?? 0));
  const [slots, setSlots] = useState<StickerSlot[]>(template?.slots ?? []);
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
      // 이미지를 바꾸면 칸 좌표는 % 라 그대로 쓸 수 있으므로 slots 는 건드리지 않는다.
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
    if (slots.length === 0) {
      setError('사진이 들어갈 칸을 최소 한 개 이상 지정해 주세요.');
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
      slots,
      displayOrder: Number(displayOrder) || 0,
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
    <form
      onSubmit={handleSubmit}
      className={cn(
        framed ? 'max-w-3xl space-y-6 rounded-xl border border-line bg-white p-6' : 'space-y-6',
      )}
    >
      <div className="grid grid-cols-[1fr_9rem_7rem] gap-4">
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
        </div>

        <div>
          <label htmlFor="displayOrder" className={LABEL}>
            정렬
          </label>
          <input
            id="displayOrder"
            type="number"
            min={0}
            max={9999}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            className={FIELD}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-ink-sub">
        공개 상태만 앱 스티커 탭에 보입니다. 정렬 값이 작을수록 앞에 나옵니다.
      </p>

      <div>
        <span className={LABEL}>템플릿 이미지</span>
        <div className="mt-1 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            disabled={busy}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
          />
          {uploading && <span className="text-sm text-ink-sub">올리는 중…</span>}
          {image && !uploading && (
            <span className="text-sm text-ink-sub">
              {image.width} × {image.height}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-sub">
          PNG · JPG · WebP, 5MB 이하. 사진 자리가 비어 있는(또는 단색으로 채워진) 이미지를 올린 뒤
          아래에서 그 자리를 지정하면 됩니다.
        </p>
      </div>

      {image ? (
        <div>
          <span className={LABEL}>사진 칸</span>
          <div className="mt-2">
            <StickerSlotEditor
              imageUrl={image.url}
              imageWidth={image.width}
              imageHeight={image.height}
              slots={slots}
              onChange={setSlots}
            />
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-sub">
          템플릿 이미지를 올리면 사진 칸을 지정할 수 있습니다.
        </p>
      )}

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
    </form>
  );
}

/** 업로드 전에 원본 픽셀 크기를 읽는다 — 미리보기 비율과 합성 캔버스 크기의 기준이 된다 */
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
