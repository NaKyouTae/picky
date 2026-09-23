'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import {
  NOTICE_PAGE_SIZE,
  NOTICE_STATUSES,
  NOTICE_STATUS_LABELS,
  NOTICE_STATUS_STYLES,
  fromDateTimeInput,
  isScheduled,
  toDateTimeInput,
  type AdminNotice,
  type AdminNoticePage,
  type NoticeStatus,
} from '@/lib/notices';
import { formatDateTime } from '@/lib/users';

const COLUMN_COUNT = 5;

/** 조회 조건 — 하나라도 바뀌면 커서를 버리고 첫 페이지부터 다시 본다 */
type Filters = {
  query: string;
  status: NoticeStatus | '';
};

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type LoadedPage = {
  key: string;
  page: AdminNoticePage | null;
  error: string | null;
};

const EMPTY_FILTERS: Filters = { query: '', status: '' };

type FormValues = {
  title: string;
  content: string;
  status: NoticeStatus;
  isPinned: boolean;
  /** `datetime-local` 값 — 빈 칸이면 공개로 바꿀 때 서버가 현재 시각을 넣는다 */
  publishedAt: string;
};

const EMPTY_FORM: FormValues = {
  title: '',
  content: '',
  status: 'DRAFT',
  isPinned: false,
  publishedAt: '',
};

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 공지사항 관리.
 *
 * 목록은 커서 기반(이전/다음)이고, 등록·수정·삭제는 모달에서 처리한다.
 * 앱에 보이는 조건은 '공개 + 게시 시각이 지남' 두 가지라, 예약된 공지는 목록에 따로 표시한다.
 */
export function NoticesTable() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 지나온 페이지의 커서 — 첫 페이지는 커서가 없으므로 null */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  /** 저장·삭제한 뒤 같은 조건을 다시 불러오기 위한 값 */
  const [reloadToken, setReloadToken] = useState(0);

  /** null = 닫힘, 'new' = 등록, 그 외 = 수정 대상 */
  const [editing, setEditing] = useState<AdminNotice | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const cursor = cursors[cursors.length - 1];
  const key = JSON.stringify([filters, cursor, reloadToken]);
  // 도착한 결과의 조건이 현재 조건과 다르면 아직 이 페이지를 못 받은 것이다.
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current, currentCursor] = JSON.parse(key) as [Filters, string | null, number];

    const params = new URLSearchParams({ take: String(NOTICE_PAGE_SIZE) });
    if (current.query) params.set('q', current.query);
    if (current.status) params.set('status', current.status);
    if (currentCursor) params.set('cursor', currentCursor);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/notices?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        setLoaded({ key, page: (await res.json()) as AdminNoticePage, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          page: null,
          error: e instanceof Error ? e.message : '공지사항 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  function applyFilters(next: Filters) {
    setCursors([null]);
    setFilters(next);
  }

  function open(target: AdminNotice | 'new') {
    setEditing(target);
    setFormError(null);
    setPending(null);
    setValues(
      target === 'new'
        ? EMPTY_FORM
        : {
            title: target.title,
            content: target.content,
            status: target.status,
            isPinned: target.isPinned,
            publishedAt: toDateTimeInput(target.publishedAt),
          },
    );
  }

  function set<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  /** 등록은 최신순 목록의 맨 앞에 오므로 첫 페이지로 돌아가고, 수정은 보던 페이지를 지킨다 */
  function reload({ toFirstPage }: { toFirstPage: boolean }) {
    if (toFirstPage) setCursors([null]);
    setReloadToken((token) => token + 1);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending('save');
    setFormError(null);

    const isNew = editing === 'new';
    // 빈 칸은 null 로 보낸다 — 생략하면 수정에서 "그대로 두기" 가 되어 비워지지 않는다.
    const body = {
      title: values.title.trim(),
      content: values.content.trim(),
      status: values.status,
      isPinned: values.isPinned,
      publishedAt: fromDateTimeInput(values.publishedAt),
    };

    try {
      const res = await fetch(
        isNew ? '/api/admin/notices' : `/api/admin/notices/${(editing as AdminNotice).id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await readError(res));

      setEditing(null);
      setPending(null);
      reload({ toFirstPage: isNew });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(null);
    }
  }

  async function handleDelete(notice: AdminNotice) {
    if (!window.confirm(`'${notice.title}' 공지를 삭제할까요?`)) return;

    setPending('delete');
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/notices/${notice.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));

      setEditing(null);
      setPending(null);
      // 지운 공지가 있던 페이지가 비어 버릴 수 있으므로 첫 페이지로 돌아간다.
      reload({ toFirstPage: true });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      setPending(null);
    }
  }

  const page = loading ? null : (loaded?.page ?? null);
  const error = loading ? null : (loaded?.error ?? null);
  const items = page?.items ?? [];
  const pageNumber = cursors.length;
  const hasPrev = pageNumber > 1;
  const hasNext = Boolean(page?.nextCursor);
  const filtered = Boolean(filters.query || filters.status);
  /** 행 대신 보여줄 안내 (없으면 null) — 표와 모바일 카드가 같이 쓴다 */
  const message = loading
    ? '불러오는 중…'
    : (error ??
      (items.length === 0
        ? filtered
          ? '조건에 맞는 공지가 없습니다.'
          : '등록된 공지가 없습니다.'
        : null));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ ...filters, query: input.trim() });
          }}
          className="flex w-full gap-2 sm:w-auto"
        >
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="제목 검색"
            aria-label="제목 검색"
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:w-60"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 sm:h-10"
          >
            검색
          </button>
        </form>

        <select
          value={filters.status}
          onChange={(event) =>
            applyFilters({ ...filters, status: event.target.value as NoticeStatus | '' })
          }
          aria-label="상태 필터"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:flex-none"
        >
          <option value="">전체 상태</option>
          {NOTICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {NOTICE_STATUS_LABELS[status]}
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
            className="h-11 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100 sm:h-10 sm:w-auto"
          >
            초기화
          </button>
        )}

        <button
          type="button"
          onClick={() => open('new')}
          className="h-11 w-full rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:opacity-90 sm:ml-auto sm:h-10 sm:w-auto"
        >
          공지 등록
        </button>
      </div>

      {/* 모바일 — 표 대신 카드. 카드를 누르면 수정 모달이 열린다 */}
      <div className="mt-4 space-y-2 lg:hidden">
        {message ? (
          <p
            className={`rounded-xl border border-line bg-white px-4 py-10 text-center text-sm ${
              error ? 'text-brand-600' : 'text-ink-sub'
            }`}
          >
            {message}
          </p>
        ) : (
          items.map((notice) => (
            <button
              key={notice.id}
              type="button"
              onClick={() => open(notice)}
              className="block w-full rounded-xl border border-line bg-white p-4 text-left active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {notice.isPinned && <span className="mr-1 text-brand-600">고정</span>}
                    {notice.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-sub">{notice.content}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${NOTICE_STATUS_STYLES[notice.status]}`}
                >
                  {NOTICE_STATUS_LABELS[notice.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-xs text-ink-sub">
                <span>{publishedLabel(notice)}</span>
                <span className="ml-auto">{formatDateTime(notice.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-white lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="px-4 py-3 font-medium">
                제목
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                고정
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                게시일
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                등록일
              </th>
            </tr>
          </thead>
          <tbody>
            {message && (
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className={`px-4 py-10 text-center ${error ? 'text-brand-600' : 'text-ink-sub'}`}
                >
                  {message}
                </td>
              </tr>
            )}

            {!message &&
              items.map((notice) => (
                <tr key={notice.id} className="border-b border-line last:border-0">
                  <td className="max-w-md px-4 py-3">
                    <button
                      type="button"
                      onClick={() => open(notice)}
                      className="truncate text-left font-medium hover:text-brand-600 hover:underline"
                    >
                      {notice.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${NOTICE_STATUS_STYLES[notice.status]}`}
                    >
                      {NOTICE_STATUS_LABELS[notice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{notice.isPinned ? '고정' : '—'}</td>
                  <td className="px-4 py-3 text-ink-sub">{publishedLabel(notice)}</td>
                  <td className="px-4 py-3 text-ink-sub">{formatDateTime(notice.createdAt)}</td>
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
            className="h-11 rounded-lg border border-line bg-white px-4 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white sm:h-9"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => setCursors((prev) => [...prev, page?.nextCursor ?? null])}
            disabled={!hasNext || loading}
            className="h-11 rounded-lg border border-line bg-white px-4 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white sm:h-9"
          >
            다음
          </button>
        </div>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? '공지 등록' : '공지 수정'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="title" className={LABEL}>
              제목
            </label>
            <input
              id="title"
              value={values.title}
              onChange={(event) => set('title', event.target.value)}
              required
              maxLength={200}
              placeholder="9월 26일 서비스 점검 안내"
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="content" className={LABEL}>
              본문
            </label>
            <textarea
              id="content"
              value={values.content}
              onChange={(event) => set('content', event.target.value)}
              required
              rows={12}
              placeholder={
                '더 나은 서비스를 위해 점검을 진행합니다.\n\n점검 시간: 9월 26일 02:00~04:00'
              }
              className={`${FIELD} resize-y font-mono leading-6`}
            />
            {/* 앱은 이 글을 그대로(줄바꿈만 살려) 보여준다 — 마크다운·HTML 은 해석되지 않는다 */}
            <p className="mt-1 text-xs text-ink-sub">
              줄바꿈은 그대로 보입니다. 마크다운·HTML 은 쓸 수 없습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className={LABEL}>
                상태
              </label>
              <select
                id="status"
                value={values.status}
                onChange={(event) => set('status', event.target.value as NoticeStatus)}
                className={FIELD}
              >
                {NOTICE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {NOTICE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="publishedAt" className={LABEL}>
                게시일시
              </label>
              <input
                id="publishedAt"
                type="datetime-local"
                value={values.publishedAt}
                onChange={(event) => set('publishedAt', event.target.value)}
                className={FIELD}
              />
              <p className="mt-1 text-xs text-ink-sub">
                비우면 공개로 바꾼 시각이 들어갑니다. 앞으로의 시각을 넣으면 그때부터 보입니다.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={values.isPinned}
              onChange={(event) => set('isPinned', event.target.checked)}
              className="size-4 rounded border-line"
            />
            앱 목록 맨 위에 고정 (&apos;중요&apos; 배지가 붙습니다)
          </label>

          {formError && <p className="text-sm text-brand-600">{formError}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending !== null}
              className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 sm:h-10"
            >
              {pending === 'save' ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-11 rounded-lg border border-line px-4 text-sm font-medium text-ink-sub hover:bg-gray-100 sm:h-10"
            >
              취소
            </button>
            {editing !== null && editing !== 'new' && (
              <button
                type="button"
                onClick={() => void handleDelete(editing)}
                disabled={pending !== null}
                className="ml-auto h-11 rounded-lg px-4 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60 sm:h-10"
              >
                {pending === 'delete' ? '삭제 중…' : '삭제'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** 게시일 칸 — 공개했지만 아직 시각이 오지 않은 공지는 앱에 안 보이므로 예약임을 밝힌다 */
function publishedLabel(notice: AdminNotice): string {
  if (!notice.publishedAt) return '게시 전';
  const when = formatDateTime(notice.publishedAt);
  return isScheduled(notice) ? `${when} 예약` : when;
}

/** 서버가 준 메시지를 그대로 보여준다 (검증 실패 이유 등) */
async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    return message ?? `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}
