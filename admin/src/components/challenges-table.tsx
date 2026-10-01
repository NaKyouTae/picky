'use client';

import { useEffect, useState } from 'react';
import { ChallengeForm } from '@/components/challenge-form';
import { Modal } from '@/components/modal';
import {
  CHALLENGE_PAGE_SIZE,
  CHALLENGE_STATUS_LABELS,
  CHALLENGE_STATUS_STYLES,
  STATUSES,
  type AdminChallenge,
  type AdminChallengeCategory,
  type AdminChallengePage,
  type ChallengeStatus,
} from '@/lib/challenges';
import { formatDateTime } from '@/lib/users';

const COLUMN_COUNT = 5;

/** 조회 조건 — 하나라도 바뀌면 커서를 버리고 첫 페이지부터 다시 본다 */
type Filters = {
  query: string;
  categoryId: string;
  status: ChallengeStatus | '';
};

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type LoadedPage = {
  key: string;
  page: AdminChallengePage | null;
  error: string | null;
};

const EMPTY_FILTERS: Filters = { query: '', categoryId: '', status: '' };

export function ChallengesTable({ categories }: { categories: AdminChallengeCategory[] }) {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 지나온 페이지의 커서 — 첫 페이지는 커서가 없으므로 null */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  /** 모달에서 저장한 뒤 같은 조건을 다시 불러오기 위한 값 */
  const [reloadToken, setReloadToken] = useState(0);
  /** null = 닫힘, 'new' = 등록, 그 외 = 수정 대상 */
  const [editing, setEditing] = useState<AdminChallenge | 'new' | null>(null);

  const cursor = cursors[cursors.length - 1];
  const key = JSON.stringify([filters, cursor, reloadToken]);
  // 도착한 결과의 조건이 현재 조건과 다르면 아직 이 페이지를 못 받은 것이다.
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current, currentCursor] = JSON.parse(key) as [Filters, string | null, number];

    const params = new URLSearchParams({ take: String(CHALLENGE_PAGE_SIZE) });
    if (current.query) params.set('q', current.query);
    if (current.categoryId) params.set('categoryId', current.categoryId);
    if (current.status) params.set('status', current.status);
    if (currentCursor) params.set('cursor', currentCursor);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/challenges?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        setLoaded({ key, page: (await res.json()) as AdminChallengePage, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          page: null,
          error: e instanceof Error ? e.message : '챌린지 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  function applyFilters(next: Filters) {
    setCursors([null]);
    setFilters(next);
  }

  /**
   * 모달에서 저장·삭제를 마친 뒤.
   * 수정은 보고 있던 페이지를 그대로 다시 불러오고,
   * 등록(최신순 맨 앞에 온다)과 삭제(지우던 행이 마지막이면 빈 페이지가 남는다)는 첫 페이지로 돌아간다.
   */
  function handleDone(result: 'created' | 'updated' | 'deleted') {
    setEditing(null);
    if (result !== 'updated') setCursors([null]);
    setReloadToken((token) => token + 1);
  }

  const page = loading ? null : (loaded?.page ?? null);
  const error = loading ? null : (loaded?.error ?? null);
  const items = page?.items ?? [];
  const pageNumber = cursors.length;
  const hasPrev = pageNumber > 1;
  const hasNext = Boolean(page?.nextCursor);
  const filtered = Boolean(filters.query || filters.categoryId || filters.status);
  /** 행 대신 보여줄 안내 (없으면 null) — 표와 모바일 카드가 같이 쓴다 */
  const message = loading
    ? '불러오는 중'
    : (error ??
      (items.length === 0
        ? filtered
          ? '조건에 맞는 챌린지가 없습니다.'
          : '등록된 챌린지가 없습니다.'
        : null));

  return (
    <div>
      {/* 카테고리 — 세 개로 고정이라 드롭다운 대신 눌러서 바로 거르는 라벨로 둔다 */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="카테고리 필터">
        <CategoryChip
          label="전체"
          active={filters.categoryId === ''}
          onClick={() => applyFilters({ ...filters, categoryId: '' })}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={`${category.emoji ? `${category.emoji} ` : ''}${category.name}`}
            active={filters.categoryId === category.id}
            onClick={() => applyFilters({ ...filters, categoryId: category.id })}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
            applyFilters({ ...filters, status: event.target.value as ChallengeStatus | '' })
          }
          aria-label="상태 필터"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:flex-none"
        >
          <option value="">전체 상태</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {CHALLENGE_STATUS_LABELS[status]}
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
          onClick={() => setEditing('new')}
          className="h-11 w-full rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:opacity-90 sm:ml-auto sm:h-10 sm:w-auto"
        >
          챌린지 등록
        </button>
      </div>

      {/* 모바일 — 표 대신 카드. 카드를 통째로 눌러 수정 모달을 연다 */}
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
          items.map((challenge) => (
            <button
              key={challenge.id}
              type="button"
              onClick={() => setEditing(challenge)}
              className="block w-full rounded-xl border border-line bg-white p-4 text-left active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-ink-sub">
                    {challenge.category.emoji} {challenge.category.name}
                  </p>
                  <p className="mt-0.5 font-medium">{challenge.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CHALLENGE_STATUS_STYLES[challenge.status]}`}
                >
                  {CHALLENGE_STATUS_LABELS[challenge.status]}
                </span>
              </div>
              <div className="mt-3 border-t border-line pt-2 text-right text-xs text-ink-sub">
                {formatDateTime(challenge.createdAt)}
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
                카테고리
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
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-ink-sub">
                  불러오는 중
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
                  {filtered ? '조건에 맞는 챌린지가 없습니다.' : '등록된 챌린지가 없습니다.'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              items.map((challenge) => (
                <tr key={challenge.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink-sub">
                    {challenge.category.emoji} {challenge.category.name}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing(challenge)}
                      className="text-left font-medium hover:text-brand-600 hover:underline"
                    >
                      {challenge.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHALLENGE_STATUS_STYLES[challenge.status]}`}
                    >
                      {CHALLENGE_STATUS_LABELS[challenge.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{formatDateTime(challenge.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(challenge)}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      수정
                    </button>
                  </td>
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
        title={editing === 'new' ? '챌린지 등록' : '챌린지 수정'}
      >
        <ChallengeForm
          // 수정 대상이 바뀌면 폼을 새로 만든다 — 모달을 닫지 않고 다른 행을 열어도 값이 남지 않는다.
          key={editing === 'new' || editing === null ? 'new' : editing.id}
          challenge={editing === 'new' || editing === null ? undefined : editing}
          categories={categories}
          onDone={handleDone}
          onCancel={() => setEditing(null)}
        />
      </Modal>
    </div>
  );
}

/** 카테고리 필터 라벨 하나 — 누르면 그 카테고리만 남는다 */
function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-full border px-4 text-sm font-medium sm:h-9 ${
        active
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-line bg-white text-ink-sub hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}
