'use client';

import { useEffect, useState } from 'react';
import {
  ORDER_PAGE_SIZE,
  formatDate,
  formatKrw,
  isMembershipActive,
  remainingDays,
  type AdminMembershipOrderPage,
} from '@/lib/membership-orders';
import { formatDateTime } from '@/lib/users';

// 사용자·회원권·결제일시·시작일·종료일·상태
const COLUMN_COUNT = 6;

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type Loaded = {
  key: string;
  page: AdminMembershipOrderPage | null;
  error: string | null;
};

type Filters = { query: string; onlyActive: boolean };

const EMPTY_FILTERS: Filters = { query: '', onlyActive: false };

/**
 * 사용자가 결제한 회원권.
 *
 * 결제 내역과 같은 API 를 쓰되 승인된 건만 본다 — 여기서 궁금한 것은 "누가 언제부터 언제까지
 * 쓸 수 있는가" 라서 실패·대기 건은 결제 내역 화면에 맡긴다.
 * 커서는 앞으로만 진행되므로 '이전' 을 위해 지나온 커서를 스택으로 들고 있는다.
 */
export function UserMembershipsTable() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 지나온 페이지의 커서 — 첫 페이지는 커서가 없으므로 null */
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const cursor = cursors[cursors.length - 1];
  const key = JSON.stringify([filters, cursor]);
  // 도착한 결과의 조건이 현재 조건과 다르면 아직 이 페이지를 못 받은 것이다.
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current, currentCursor] = JSON.parse(key) as [Filters, string | null];

    const params = new URLSearchParams({ take: String(ORDER_PAGE_SIZE), status: 'PAID' });
    if (current.query) params.set('q', current.query);
    // 이용 중 판정(종료일 비교)은 서버가 한다 — 페이지를 나눠 받으므로 화면에서 거르면 안 된다.
    if (current.onlyActive) params.set('active', 'true');
    if (currentCursor) params.set('cursor', currentCursor);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/membership-orders?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        setLoaded({ key, page: (await res.json()) as AdminMembershipOrderPage, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          page: null,
          error: e instanceof Error ? e.message : '회원권을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  /** 조건이 바뀌면 커서를 처음으로 되돌린다 — 다른 조건의 커서는 의미가 없다 */
  function applyFilters(next: Filters) {
    setFilters(next);
    setCursors([null]);
  }

  const page = loading ? null : loaded?.page;
  const error = loading ? null : (loaded?.error ?? null);
  const items = page?.items ?? [];
  const filtered = Boolean(filters.query || filters.onlyActive);

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
            placeholder="사용자 이름·이메일 검색"
            aria-label="사용자 이름·이메일 검색"
            className="h-10 w-60 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            검색
          </button>
        </form>

        <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={filters.onlyActive}
            onChange={(event) => applyFilters({ ...filters, onlyActive: event.target.checked })}
            className="size-4"
          />
          이용 중만 보기
        </label>

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
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="px-4 py-3 font-medium">
                사용자
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                회원권
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                결제일시
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                시작일
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                종료일
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
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
                  {filtered ? '조건에 맞는 회원권이 없습니다.' : '결제된 회원권이 없습니다.'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              items.map((order) => {
                const active = isMembershipActive(order.endsAt);
                const left = remainingDays(order.endsAt);
                return (
                  <tr key={order.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.user.name}</p>
                      {order.user.email && (
                        <p className="mt-0.5 text-xs text-ink-sub">{order.user.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p>{order.planName}</p>
                      <p className="mt-0.5 text-xs text-ink-sub">
                        {order.months}개월 · {formatKrw(order.amount)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-sub">
                      {order.paidAt ? formatDateTime(order.paidAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-sub">
                      {order.startsAt ? formatDate(order.startsAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-sub">
                      {order.endsAt ? formatDate(order.endsAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-ink-sub'
                        }`}
                      >
                        {active ? '이용 중' : '만료'}
                      </span>
                      {/* 언제 끝나는지가 문의 대응에서 가장 자주 묻는 값이다 */}
                      {active && <p className="mt-1 text-xs text-ink-sub">{left}일 남음</p>}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursors((stack) => stack.slice(0, -1))}
          disabled={cursors.length === 1 || loading}
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-40"
        >
          이전
        </button>
        <span className="text-sm text-ink-sub">{cursors.length}쪽</span>
        <button
          type="button"
          onClick={() => setCursors((stack) => [...stack, page?.nextCursor ?? null])}
          disabled={!page?.nextCursor || loading}
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  );
}
