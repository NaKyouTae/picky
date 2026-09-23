'use client';

import { useEffect, useState } from 'react';
import { PROVIDER_LABELS, ProviderCell } from '@/components/provider-logos';
import {
  EMPTY,
  formatBirthday,
  formatDateTime,
  GENDER_LABELS,
  PAGE_SIZE,
  PROVIDERS,
  shortId,
  STATUS_LABELS,
  STATUS_STYLES,
  type AdminUserPage,
} from '@/lib/users';

// ID·이름·이메일·성별·나이대·생일·상태·권한·가입일·수정일 + 제공자 컬럼
const COLUMN_COUNT = 10 + PROVIDERS.length;

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type LoadedPage = {
  query: string;
  cursor: string | null;
  page: AdminUserPage | null;
  error: string | null;
};

/**
 * 사용자 목록 테이블.
 * 전체를 한 번에 받지 않고 커서 기반으로 한 페이지(PAGE_SIZE)씩 불러온다.
 * 커서는 앞으로만 진행되므로 '이전' 을 위해 지나온 커서를 스택으로 들고 있는다.
 */
export function UsersTable() {
  const [input, setInput] = useState('');
  /** 실제로 조회에 쓰이는 검색어 (입력 즉시가 아니라 제출 시점에 반영) */
  const [query, setQuery] = useState('');
  /** 지나온 페이지의 커서 — 첫 페이지는 커서가 없으므로 null */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  /** 마지막으로 도착한 응답과 그때의 조회 조건 */
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);

  const cursor = cursors[cursors.length - 1];
  // 도착한 결과의 조건이 현재 조건과 다르면 아직 이 페이지를 못 받은 것이다.
  // loading 을 별도 state 로 두면 effect 안에서 동기 setState 를 해야 해서 파생값으로 계산한다.
  const loading = !loaded || loaded.query !== query || loaded.cursor !== cursor;

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ take: String(PAGE_SIZE) });
    if (query) params.set('q', query);
    if (cursor) params.set('cursor', cursor);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/users?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        const page = (await res.json()) as AdminUserPage;
        setLoaded({ query, cursor, page, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          query,
          cursor,
          page: null,
          error: e instanceof Error ? e.message : '사용자 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [query, cursor]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    // 검색 조건이 바뀌면 커서를 버리고 첫 페이지부터 다시 본다.
    setCursors([null]);
    setQuery(input.trim());
  }

  function handleReset() {
    setInput('');
    setCursors([null]);
    setQuery('');
  }

  const page = loading ? null : (loaded?.page ?? null);
  const error = loading ? null : (loaded?.error ?? null);
  const items = page?.items ?? [];
  const pageNumber = cursors.length;
  const hasPrev = pageNumber > 1;
  const hasNext = Boolean(page?.nextCursor);
  /** 행 대신 보여줄 안내 (없으면 null) — 표와 모바일 카드가 같이 쓴다 */
  const message = loading
    ? '불러오는 중…'
    : (error ??
      (items.length === 0 ? (query ? '검색 결과가 없습니다.' : '사용자가 없습니다.') : null));

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="이름 또는 이메일 검색"
          aria-label="이름 또는 이메일 검색"
          className="h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:w-72"
        />
        <button
          type="submit"
          className="h-11 flex-1 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 sm:h-10 sm:flex-none"
        >
          검색
        </button>
        {query && (
          <button
            type="button"
            onClick={handleReset}
            className="h-11 flex-1 rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100 sm:h-10 sm:flex-none"
          >
            초기화
          </button>
        )}
      </form>

      {query && (
        <p className="mt-3 text-sm text-ink-sub">
          <span className="font-medium text-ink">{query}</span> 검색 결과
        </p>
      )}

      {/* 모바일 — 14열짜리 표는 가로 스크롤로 읽을 수 없어 카드로 바꾼다 */}
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
          items.map((user) => (
            <article key={user.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-ink-sub">{user.email ?? EMPTY}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[user.status]}`}
                >
                  {STATUS_LABELS[user.status]}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {user.providers.length === 0 ? (
                  <span className="text-xs text-ink-sub">연결된 SNS 없음</span>
                ) : (
                  PROVIDERS.filter((provider) => user.providers.includes(provider)).map(
                    (provider) => <ProviderCell key={provider} provider={provider} linked />,
                  )
                )}
                {user.role === 'ADMIN' && (
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                    관리자
                  </span>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-y-1 border-t border-line pt-3 text-xs">
                <Field label="ID" value={shortId(user.id)} mono />
                <Field label="성별" value={user.gender ? GENDER_LABELS[user.gender] : EMPTY} />
                <Field label="나이대" value={user.ageRange ?? EMPTY} />
                <Field label="생일" value={formatBirthday(user.birthday)} />
                <Field label="가입일" value={formatDateTime(user.createdAt)} />
                <Field label="수정일" value={formatDateTime(user.updatedAt)} />
              </dl>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-white lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="px-4 py-3 font-medium">
                ID
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                이름
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                이메일
              </th>
              {PROVIDERS.map((provider) => (
                <th key={provider} scope="col" className="px-4 py-3 text-center font-medium">
                  {PROVIDER_LABELS[provider]}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 font-medium">
                성별
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                나이대
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                생일
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                권한
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                가입일
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                수정일
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
                  {query ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              items.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-ink-sub" title={user.id}>
                    {shortId(user.id)}
                  </td>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-ink-sub">{user.email ?? EMPTY}</td>
                  {PROVIDERS.map((provider) => (
                    <td key={provider} className="px-4 py-3 text-center">
                      <ProviderCell
                        provider={provider}
                        linked={user.providers.includes(provider)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-ink-sub">
                    {user.gender ? GENDER_LABELS[user.gender] : EMPTY}
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{user.ageRange ?? EMPTY}</td>
                  <td className="px-4 py-3 text-ink-sub">{formatBirthday(user.birthday)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[user.status]}`}
                    >
                      {STATUS_LABELS[user.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">
                    {user.role === 'ADMIN' ? '관리자' : '일반'}
                  </td>
                  <td className="px-4 py-3 text-ink-sub">{formatDateTime(user.createdAt)}</td>
                  <td className="px-4 py-3 text-ink-sub">{formatDateTime(user.updatedAt)}</td>
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
    </div>
  );
}

/** 모바일 카드의 라벨 + 값 한 줄 (부모 dl 의 2열 그리드에 그대로 얹힌다) */
function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-ink-sub">{label}</dt>
      <dd className={mono ? 'truncate font-mono' : 'truncate'}>{value}</dd>
    </>
  );
}
