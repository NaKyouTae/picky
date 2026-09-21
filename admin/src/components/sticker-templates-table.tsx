'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { StickerTemplateForm } from '@/components/sticker-template-form';
import {
  STICKER_LIST_LIMIT,
  STICKER_STATUSES,
  STICKER_STATUS_LABELS,
  STICKER_STATUS_STYLES,
  type AdminStickerTemplate,
  type AdminStickerTemplatePage,
  type StickerTemplateStatus,
} from '@/lib/sticker-templates';
import { formatDateTime } from '@/lib/users';

const COLUMN_COUNT = 5;

/** 조회 조건 — 필터가 걸리면 전체 순서를 알 수 없으므로 드래그를 막는다 */
type Filters = { query: string; status: StickerTemplateStatus | '' };

const EMPTY_FILTERS: Filters = { query: '', status: '' };

type Loaded = {
  key: string;
  items: AdminStickerTemplate[] | null;
  error: string | null;
};

/**
 * 스티커 템플릿 목록 — 행을 끌어 노출 순서를 바꾼다.
 *
 * 순서는 목록 전체를 한 번에 다시 매기는 구조라 페이지를 나누지 않고 모두 불러온다
 * (관리자가 직접 등록하는 규모라 수백 건을 넘지 않는다). 검색·상태 필터가 걸려 있으면
 * 화면에 보이는 행이 전체가 아니므로 드래그를 비활성화한다.
 */
export function StickerTemplatesTable() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 저장 후 같은 조건으로 다시 불러오기 위한 값 */
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [creating, setCreating] = useState(false);

  /** 드래그 중인 행의 인덱스 (null 이면 드래그 중 아님) */
  const [dragging, setDragging] = useState<number | null>(null);
  /** 드롭되면 그 자리로 들어갈 인덱스 */
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const key = JSON.stringify([filters, reloadToken]);
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current] = JSON.parse(key) as [Filters, number];

    const params = new URLSearchParams({ take: String(STICKER_LIST_LIMIT) });
    if (current.query) params.set('q', current.query);
    if (current.status) params.set('status', current.status);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/sticker-templates?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        const page = (await res.json()) as AdminStickerTemplatePage;
        setLoaded({ key, items: page.items, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          items: null,
          error: e instanceof Error ? e.message : '템플릿 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  function applyFilters(next: Filters) {
    setOrderError(null);
    setFilters(next);
  }

  function reload() {
    setReloadToken((token) => token + 1);
  }

  const items = loading ? [] : (loaded?.items ?? []);
  const error = loading ? null : (loaded?.error ?? null);
  const filtered = Boolean(filters.query || filters.status);
  // 필터가 걸린 목록은 일부만 보이므로 그 순서를 전체 순서로 저장하면 안 된다.
  const sortable = !filtered && !loading && !error && items.length > 1;

  /** 드래그한 행을 목표 자리로 옮기고 서버에 전체 순서를 저장한다 */
  async function commitReorder(from: number, to: number) {
    if (from === to) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    // 낙관적 반영 — 드래그를 놓자마자 새 순서를 보여준다.
    setLoaded({ key, items: next, error: null });
    setSaving(true);
    setOrderError(null);

    try {
      const res = await fetch('/api/admin/sticker-templates/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      if (!res.ok) throw new Error(await readError(res));
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : '순서를 저장하지 못했습니다.');
      // 저장이 실패하면 화면과 서버가 어긋나므로 서버 순서를 다시 읽어 되돌린다.
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ ...filters, query: input.trim() });
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="제목 검색"
            aria-label="제목 검색"
            className="h-10 w-60 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            검색
          </button>
        </form>

        <select
          value={filters.status}
          onChange={(event) =>
            applyFilters({ ...filters, status: event.target.value as StickerTemplateStatus | '' })
          }
          aria-label="상태 필터"
          className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
        >
          <option value="">전체 상태</option>
          {STICKER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STICKER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        {filtered && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              applyFilters(EMPTY_FILTERS);
            }}
            className="h-10 rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100"
          >
            초기화
          </button>
        )}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          템플릿 등록
        </button>
      </div>

      <p className="mt-3 text-sm text-ink-sub">
        {filtered
          ? '검색·필터를 끄면 행을 끌어 순서를 바꿀 수 있습니다.'
          : '행 왼쪽 손잡이를 끌어 앱에 보이는 순서를 바꿉니다. 위에 있을수록 먼저 보입니다.'}
        {saving && <span className="ml-2 text-ink">저장 중…</span>}
      </p>

      {orderError && <p className="mt-2 text-sm text-brand-600">{orderError}</p>}

      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="w-10 px-2 py-3 font-medium">
                <span className="sr-only">순서</span>
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                미리보기
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                제목
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                등록일
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-ink-sub">
                  불러오는 중…
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-brand-600">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-ink-sub">
                  {filtered ? '조건에 맞는 템플릿이 없습니다.' : '등록된 템플릿이 없습니다.'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              items.map((template, index) => (
                <tr
                  key={template.id}
                  draggable={sortable}
                  onDragStart={(event) => {
                    setDragging(index);
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox 는 데이터가 없으면 드래그를 시작하지 않는다.
                    event.dataTransfer.setData('text/plain', template.id);
                  }}
                  onDragOver={(event) => {
                    if (dragging === null) return;
                    // 기본 동작을 막아야 이 행이 드롭을 받을 수 있다.
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOver(index);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging !== null) void commitReorder(dragging, index);
                    setDragging(null);
                    setDragOver(null);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setDragOver(null);
                  }}
                  className={[
                    'border-b border-line last:border-0',
                    dragging === index ? 'opacity-40' : '',
                    dragOver === index && dragging !== index ? 'bg-brand-500/5' : '',
                  ].join(' ')}
                >
                  <td className="px-2 py-3">
                    <span
                      aria-hidden
                      title={sortable ? '끌어서 순서 바꾸기' : undefined}
                      className={`flex h-8 w-6 items-center justify-center text-ink-sub ${
                        sortable ? 'cursor-grab active:cursor-grabbing' : 'opacity-30'
                      }`}
                    >
                      <DragHandleIcon />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="relative w-24 overflow-hidden rounded-lg bg-gray-100"
                      style={{ aspectRatio: `${template.imageWidth} / ${template.imageHeight}` }}
                    >
                      <Image
                        src={template.imageUrl}
                        alt=""
                        fill
                        sizes="96px"
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/stickers/${template.id}`}
                      // 드래그 중 링크가 끌려가지 않도록
                      draggable={false}
                      className="font-medium hover:text-brand-600 hover:underline"
                    >
                      {template.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STICKER_STATUS_STYLES[template.status]}`}
                    >
                      {STICKER_STATUS_LABELS[template.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{formatDateTime(template.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && !error && items.length >= STICKER_LIST_LIMIT && (
        <p className="mt-3 text-sm text-brand-600">
          템플릿이 {STICKER_LIST_LIMIT}개를 넘어 일부만 보이고 있습니다. 순서를 저장하면 보이지 않는
          템플릿의 순서가 밀릴 수 있으니 오래된 템플릿을 보관 처리해 주세요.
        </p>
      )}

      {/* 좌: 입력 / 우: 미리보기 2열이라 넓은 모달을 쓴다 */}
      <Modal open={creating} onClose={() => setCreating(false)} title="템플릿 등록" size="lg">
        <StickerTemplateForm
          framed={false}
          onDone={() => {
            setCreating(false);
            reload();
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
