'use client';

import { useEffect, useState } from 'react';
import {
  MEMBERSHIP_ORDER_STATUSES,
  MEMBERSHIP_ORDER_STATUS_LABELS,
  MEMBERSHIP_ORDER_STATUS_STYLES,
  ORDER_PAGE_SIZE,
  formatKrw,
  type AdminMembershipOrderPage,
  type MembershipOrderStatus,
  type MembershipOrderSummary,
} from '@/lib/membership-orders';
import { formatDateTime } from '@/lib/users';

// 구매자·회원권·기간·금액·수단·상태·주문번호·결제일시
const COLUMN_COUNT = 8;

/** 응답과 그 응답을 받았을 때의 조회 조건을 함께 보관해 현재 조건과 대조한다 */
type Loaded = {
  key: string;
  page: AdminMembershipOrderPage | null;
  error: string | null;
};

type Filters = { query: string; status: MembershipOrderStatus | '' };

const EMPTY_FILTERS: Filters = { query: '', status: '' };

/**
 * 전체 결제 내역 (읽기 전용).
 *
 * 커서 기반으로 한 페이지씩 받는다 — 커서는 앞으로만 진행되므로 '이전' 을 위해
 * 지나온 커서를 스택으로 들고 있는다 (사용자 목록과 같은 방식).
 * 환불 기능이 없으므로 행을 눌러 바꿀 것은 없다.
 */
export function MembershipOrdersTable({ summary }: { summary: MembershipOrderSummary }) {
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

    const params = new URLSearchParams({ take: String(ORDER_PAGE_SIZE) });
    if (current.query) params.set('q', current.query);
    if (current.status) params.set('status', current.status);
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
          error: e instanceof Error ? e.message : '결제 내역을 불러올 수 없습니다.',
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
  const filtered = Boolean(filters.query || filters.status);

  return (
    <div>
      {/* 요약 — 환불이 없으므로 승인 합계가 곧 매출이다 */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="결제 완료" value={`${summary.paidCount.toLocaleString('ko-KR')}건`} />
        <SummaryCard label="매출 합계" value={formatKrw(summary.paidAmount)} />
        <SummaryCard
          label="결제 대기"
          value={`${summary.pendingCount.toLocaleString('ko-KR')}건`}
        />
        <SummaryCard label="결제 실패" value={`${summary.failedCount.toLocaleString('ko-KR')}건`} />
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-2">
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
            placeholder="구매자·주문번호 검색"
            aria-label="구매자·주문번호 검색"
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
            applyFilters({ ...filters, status: event.target.value as MembershipOrderStatus | '' })
          }
          aria-label="상태 필터"
          className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500"
        >
          <option value="">전체 상태</option>
          {MEMBERSHIP_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {MEMBERSHIP_ORDER_STATUS_LABELS[status]}
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
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="px-4 py-3 font-medium">
                구매자
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                회원권
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                이용 기간
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                금액
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                수단
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                주문번호
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                결제일시
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
                  {filtered ? '조건에 맞는 결제가 없습니다.' : '결제 내역이 없습니다.'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              items.map((order) => (
                <tr key={order.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.user.name}</p>
                    {order.user.email && (
                      <p className="mt-0.5 text-xs text-ink-sub">{order.user.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p>{order.planName}</p>
                    <p className="mt-0.5 text-xs text-ink-sub">{order.months}개월</p>
                  </td>
                  <td className="px-4 py-3 text-ink-sub">
                    {order.startsAt && order.endsAt
                      ? `${formatDateTime(order.startsAt)} ~ ${formatDateTime(order.endsAt)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatKrw(order.amount)}</td>
                  <td className="px-4 py-3 text-ink-sub">{order.method ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${MEMBERSHIP_ORDER_STATUS_STYLES[order.status]}`}
                    >
                      {MEMBERSHIP_ORDER_STATUS_LABELS[order.status]}
                    </span>
                    {/* 왜 실패했는지가 문의 대응에 필요하다 */}
                    {order.failReason && (
                      <p className="mt-1 max-w-56 text-xs text-ink-sub">{order.failReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-sub">{order.orderCode}</td>
                  <td className="px-4 py-3 text-ink-sub">
                    {formatDateTime(order.paidAt ?? order.createdAt)}
                  </td>
                </tr>
              ))}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <dt className="text-xs text-ink-sub">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  );
}
