'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import {
  INQUIRY_PAGE_SIZE,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_STYLES,
  INQUIRY_TYPES,
  INQUIRY_TYPE_LABELS,
  type AdminInquiry,
  type AdminInquiryDetail,
  type AdminInquiryPage,
  type InquiryStatus,
  type InquiryType,
} from '@/lib/inquiries';
import { formatDateTime } from '@/lib/users';

const COLUMN_COUNT = 6;

/** 조회 조건 — 하나라도 바뀌면 커서를 버리고 첫 페이지부터 다시 본다 */
type Filters = {
  query: string;
  status: InquiryStatus | '';
  type: InquiryType | '';
};

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type LoadedPage = {
  key: string;
  page: AdminInquiryPage | null;
  error: string | null;
};

const EMPTY_FILTERS: Filters = { query: '', status: '', type: '' };

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 문의 관리.
 *
 * 문의 내용은 사용자가 보낸 글이라 고칠 수 없다 — 관리자가 바꾸는 것은 처리 상태와 메모뿐이다.
 * **답변은 여기서 보내지 않는다.** 앱이 안내한 대로 문의에 적힌 이메일로 직접 회신하고,
 * 무엇을 회신했는지만 메모에 남긴다.
 *
 * 첨부 사진은 private 버킷에 있어 주소가 짧게 만료된다. 그래서 목록에는 개수만 두고,
 * 모달을 열 때 단건 조회로 그때그때 주소를 받아 온다.
 */
export function InquiriesTable() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 지나온 페이지의 커서 — 첫 페이지는 커서가 없으므로 null */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  /** 저장·삭제한 뒤 같은 조건을 다시 불러오기 위한 값 */
  const [reloadToken, setReloadToken] = useState(0);

  /** null = 닫힘. 목록 행으로 먼저 열고, 사진이 붙은 상세가 도착하면 갈아 끼운다 */
  const [editing, setEditing] = useState<AdminInquiry | null>(null);
  const [detail, setDetail] = useState<AdminInquiryDetail | null>(null);
  const [status, setStatus] = useState<InquiryStatus>('RECEIVED');
  const [adminNote, setAdminNote] = useState('');
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const cursor = cursors[cursors.length - 1];
  const key = JSON.stringify([filters, cursor, reloadToken]);
  // 도착한 결과의 조건이 현재 조건과 다르면 아직 이 페이지를 못 받은 것이다.
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current, currentCursor] = JSON.parse(key) as [Filters, string | null, number];

    const params = new URLSearchParams({ take: String(INQUIRY_PAGE_SIZE) });
    if (current.query) params.set('q', current.query);
    if (current.status) params.set('status', current.status);
    if (current.type) params.set('type', current.type);
    if (currentCursor) params.set('cursor', currentCursor);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/inquiries?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        setLoaded({ key, page: (await res.json()) as AdminInquiryPage, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          page: null,
          error: e instanceof Error ? e.message : '문의 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  /** 모달이 열려 있는 동안 첨부 사진이 붙은 상세를 받아 온다 */
  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(`/api/admin/inquiries/${editing.id}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        setDetail((await res.json()) as AdminInquiryDetail);
      } catch {
        if (controller.signal.aborted) return;
        // 상세를 못 받아도 목록 행의 내용은 이미 보이고 있다 — 사진만 비운 채 둔다.
        setDetail(null);
      }
    })();

    return () => controller.abort();
  }, [editing]);

  function applyFilters(next: Filters) {
    setCursors([null]);
    setFilters(next);
  }

  function open(target: AdminInquiry) {
    setEditing(target);
    setDetail(null);
    setStatus(target.status);
    setAdminNote(target.adminNote ?? '');
    setFormError(null);
    setPending(null);
  }

  /** 상태 변경은 최신순 정렬을 흔들지 않으므로 보던 페이지를 지킨다 */
  function reload({ toFirstPage }: { toFirstPage: boolean }) {
    if (toFirstPage) setCursors([null]);
    setReloadToken((token) => token + 1);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;

    setPending('save');
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // 빈 문자열은 '메모 지우기' 다 (생략하면 서버가 그대로 둔다).
        body: JSON.stringify({ status, adminNote: adminNote.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res));

      setEditing(null);
      setPending(null);
      reload({ toFirstPage: false });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(null);
    }
  }

  async function handleDelete(inquiry: AdminInquiry) {
    if (!window.confirm('이 문의를 삭제할까요? 첨부한 사진도 함께 지워집니다.')) return;

    setPending('delete');
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));

      setEditing(null);
      setPending(null);
      // 지운 문의가 있던 페이지가 비어 버릴 수 있으므로 첫 페이지로 돌아간다.
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
  const filtered = Boolean(filters.query || filters.status || filters.type);
  /** 행 대신 보여줄 안내 (없으면 null) — 표와 모바일 카드가 같이 쓴다 */
  const message = loading
    ? '불러오는 중…'
    : (error ??
      (items.length === 0
        ? filtered
          ? '조건에 맞는 문의가 없습니다.'
          : '접수된 문의가 없습니다.'
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
            placeholder="내용·이메일 검색"
            aria-label="내용·이메일 검색"
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
            applyFilters({ ...filters, status: event.target.value as InquiryStatus | '' })
          }
          aria-label="상태 필터"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:flex-none"
        >
          <option value="">전체 상태</option>
          {INQUIRY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {INQUIRY_STATUS_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          value={filters.type}
          onChange={(event) =>
            applyFilters({ ...filters, type: event.target.value as InquiryType | '' })
          }
          aria-label="유형 필터"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:flex-none"
        >
          <option value="">전체 유형</option>
          {INQUIRY_TYPES.map((value) => (
            <option key={value} value={value}>
              {INQUIRY_TYPE_LABELS[value]}
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
      </div>

      {/* 모바일 — 표 대신 카드. 카드를 누르면 상세 모달이 열린다 */}
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
          items.map((inquiry) => (
            <button
              key={inquiry.id}
              type="button"
              onClick={() => open(inquiry)}
              className="block w-full rounded-xl border border-line bg-white p-4 text-left active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="mr-1 text-ink-sub">
                      [{INQUIRY_TYPE_LABELS[inquiry.type]}]
                    </span>
                    {inquiry.user.name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-sub">{inquiry.content}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${INQUIRY_STATUS_STYLES[inquiry.status]}`}
                >
                  {INQUIRY_STATUS_LABELS[inquiry.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-xs text-ink-sub">
                <span className="truncate">{inquiry.email}</span>
                {inquiry.imageCount > 0 && <span>사진 {inquiry.imageCount}장</span>}
                <span className="ml-auto">{formatDateTime(inquiry.createdAt)}</span>
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
                유형
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                내용
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                보낸 사람
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                사진
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                접수일
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
              items.map((inquiry) => (
                <tr key={inquiry.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink-sub">{INQUIRY_TYPE_LABELS[inquiry.type]}</td>
                  <td className="max-w-md px-4 py-3">
                    <button
                      type="button"
                      onClick={() => open(inquiry)}
                      className="line-clamp-2 text-left font-medium hover:text-brand-600 hover:underline"
                    >
                      {inquiry.content}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{inquiry.user.name}</p>
                    <p className="text-xs text-ink-sub">{inquiry.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">
                    {inquiry.imageCount > 0 ? `${inquiry.imageCount}장` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${INQUIRY_STATUS_STYLES[inquiry.status]}`}
                    >
                      {INQUIRY_STATUS_LABELS[inquiry.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{formatDateTime(inquiry.createdAt)}</td>
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

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="문의 상세">
        {editing && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <dl className="grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <Row label="유형" value={INQUIRY_TYPE_LABELS[editing.type]} />
              <Row label="접수일" value={formatDateTime(editing.createdAt)} />
              <Row label="보낸 사람" value={`${editing.user.name} (${editing.user.email ?? '이메일 없음'})`} />
              {/* 회신할 주소 — 계정 이메일이 아니라 문의할 때 적은 주소다 */}
              <Row label="답변 받을 주소" value={editing.email} />
            </dl>

            <div>
              <p className={LABEL}>문의 내용</p>
              {/* 사용자가 쓴 글이라 서식으로 해석하지 않고 줄바꿈만 살려 보여준다 */}
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-line px-3 py-2 text-sm leading-6">
                {editing.content}
              </p>
            </div>

            <div>
              <p className={LABEL}>
                첨부 사진
                {editing.imageCount > 0 && (
                  <span className="ml-1 font-normal text-ink-sub">{editing.imageCount}장</span>
                )}
              </p>
              {editing.imageCount === 0 ? (
                <p className="mt-1 text-sm text-ink-sub">첨부한 사진이 없습니다.</p>
              ) : detail ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {detail.images.map((image) =>
                    image.url ? (
                      <a
                        key={image.id}
                        href={image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block size-28 overflow-hidden rounded-lg border border-line"
                      >
                        {/* 짧게 만료되는 signed URL 이라 next/image 로 최적화할 대상이 아니다 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt={`첨부 사진 ${image.displayOrder + 1}`}
                          className="size-full object-cover"
                        />
                      </a>
                    ) : (
                      <p
                        key={image.id}
                        className="flex size-28 items-center justify-center rounded-lg border border-line px-2 text-center text-xs text-ink-sub"
                      >
                        불러올 수 없음
                      </p>
                    ),
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-ink-sub">사진을 불러오는 중…</p>
              )}
            </div>

            <div>
              <label htmlFor="status" className={LABEL}>
                처리 상태
              </label>
              <select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as InquiryStatus)}
                className={FIELD}
              >
                {INQUIRY_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {INQUIRY_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-sub">
                &apos;답변 완료&apos; 로 바꾼 시각이 답변일로 기록됩니다.
                {editing.answeredAt && ` (현재 ${formatDateTime(editing.answeredAt)})`}
              </p>
            </div>

            <div>
              <label htmlFor="adminNote" className={LABEL}>
                관리자 메모
              </label>
              <textarea
                id="adminNote"
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="회신한 내용·처리 경위를 적어 두세요."
                className={`${FIELD} resize-y leading-6`}
              />
              <p className="mt-1 text-xs text-ink-sub">
                사용자에게 보이지 않습니다. 답변은 위 &apos;답변 받을 주소&apos; 로 직접 메일을
                보내 주세요.
              </p>
            </div>

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
                닫기
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(editing)}
                disabled={pending !== null}
                className="ml-auto h-11 rounded-lg px-4 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60 sm:h-10"
              >
                {pending === 'delete' ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/** 라벨 : 값 한 줄 (상세 요약표) */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-sub">{label}</dt>
      <dd className="mt-0.5 break-all font-medium">{value}</dd>
    </div>
  );
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
