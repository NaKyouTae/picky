'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { StickerPreview } from '@/components/sticker-preview';
import { StickerTemplateForm } from '@/components/sticker-template-form';
import {
  STICKER_PAGE_SIZE,
  STICKER_STATUSES,
  STICKER_STATUS_LABELS,
  STICKER_STATUS_STYLES,
  type AdminStickerTemplatePage,
  type StickerTemplateStatus,
} from '@/lib/sticker-templates';
import { formatDateTime } from '@/lib/users';

const COLUMN_COUNT = 5;

/** 조회 조건 — 하나라도 바뀌면 커서를 버리고 첫 페이지부터 다시 본다 */
type Filters = { query: string; status: StickerTemplateStatus | '' };

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type LoadedPage = {
  key: string;
  page: AdminStickerTemplatePage | null;
  error: string | null;
};

const EMPTY_FILTERS: Filters = { query: '', status: '' };

export function StickerTemplatesTable() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 지나온 페이지의 커서 — 첫 페이지는 커서가 없으므로 null */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  /** 등록 모달에서 저장한 뒤 같은 조건을 다시 불러오기 위한 값 */
  const [reloadToken, setReloadToken] = useState(0);
  const [creating, setCreating] = useState(false);

  const cursor = cursors[cursors.length - 1];
  const key = JSON.stringify([filters, cursor, reloadToken]);
  // 도착한 결과의 조건이 현재 조건과 다르면 아직 이 페이지를 못 받은 것이다.
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current, currentCursor] = JSON.parse(key) as [Filters, string | null, number];

    const params = new URLSearchParams({ take: String(STICKER_PAGE_SIZE) });
    if (current.query) params.set('q', current.query);
    if (current.status) params.set('status', current.status);
    if (currentCursor) params.set('cursor', currentCursor);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/sticker-templates?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        setLoaded({ key, page: (await res.json()) as AdminStickerTemplatePage, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          page: null,
          error: e instanceof Error ? e.message : '템플릿 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  function applyFilters(next: Filters) {
    setCursors([null]);
    setFilters(next);
  }

  const page = loading ? null : (loaded?.page ?? null);
  const error = loading ? null : (loaded?.error ?? null);
  const items = page?.items ?? [];
  const pageNumber = cursors.length;
  const hasPrev = pageNumber > 1;
  const hasNext = Boolean(page?.nextCursor);
  const filtered = Boolean(filters.query || filters.status);

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

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="px-4 py-3 font-medium">
                미리보기
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                제목
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                사진 칸
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
              items.map((template) => (
                <tr key={template.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <StickerPreview
                      imageUrl={template.imageUrl}
                      imageWidth={template.imageWidth}
                      imageHeight={template.imageHeight}
                      slots={template.slots}
                      showNumbers={false}
                      sizes="96px"
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/stickers/${template.id}`}
                      className="font-medium hover:text-brand-600 hover:underline"
                    >
                      {template.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{template.slots.length}칸</td>
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

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-ink-sub">{pageNumber}페이지</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCursors((prev) => prev.slice(0, -1))}
            disabled={!hasPrev || loading}
            className="h-9 rounded-lg border border-line bg-white px-4 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => setCursors((prev) => [...prev, page?.nextCursor ?? null])}
            disabled={!hasNext || loading}
            className="h-9 rounded-lg border border-line bg-white px-4 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white"
          >
            다음
          </button>
        </div>
      </div>

      {/* 슬롯 편집기가 이미지 위에서 드래그로 영역을 찍는 화면이라 넓은 모달을 쓴다 */}
      <Modal open={creating} onClose={() => setCreating(false)} title="템플릿 등록" size="lg">
        <StickerTemplateForm
          framed={false}
          onDone={() => {
            setCreating(false);
            // 새 템플릿은 최신순 목록의 맨 앞에 오므로 첫 페이지로 돌아가 다시 불러온다.
            setCursors([null]);
            setReloadToken((token) => token + 1);
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}
