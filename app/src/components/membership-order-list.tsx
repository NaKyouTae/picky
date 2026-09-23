'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  MEMBERSHIP_ORDER_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatKrw,
} from '@/lib/membership-format';
import type { MembershipOrder, MembershipOrderPage } from '@/lib/memberships';
import { cn } from '@/lib/utils';

/** 상태별 배지 색 — 완료는 강조, 실패는 브랜드색(경고), 대기는 무채색 */
const STATUS_STYLES: Record<MembershipOrder['status'], string> = {
  PAID: 'bg-brand-500/10 text-brand-600',
  PENDING: 'bg-canvas text-ink-sub',
  FAILED: 'bg-canvas text-ink-sub',
};

/**
 * 내 결제 내역.
 *
 * 첫 페이지는 서버 컴포넌트가 넘겨주고, '더 보기' 는 커서로 이어 받는다
 * (offset 을 쓰면 뒤 페이지로 갈수록 느려지므로).
 * 환불 기능이 없으므로 여기서 하는 일은 보여주기뿐이다.
 */
export function MembershipOrderList({ first }: { first: MembershipOrderPage }) {
  const [orders, setOrders] = useState<MembershipOrder[]>(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memberships/orders?cursor=${cursor}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();

      const next = (await res.json()) as MembershipOrderPage;
      setOrders((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch {
      setError('더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="text-base font-semibold">아직 결제한 내역이 없어요</p>
        <p className="mt-2 text-sm text-ink-sub">
          회원권을 구매하면 유료 템플릿을 기간 내내 쓸 수 있어요.
        </p>
        <Link
          href="/membership"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
        >
          회원권 보기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2">
      <ol className="space-y-3">
        {orders.map((order) => (
          <li key={order.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{order.planName}</p>
                <p className="mt-0.5 text-xs text-ink-sub">
                  {formatDateTime(order.paidAt ?? order.createdAt)}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  STATUS_STYLES[order.status],
                )}
              >
                {MEMBERSHIP_ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>

            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-sub">
              <div className="flex justify-between gap-3">
                <dt>결제 금액</dt>
                <dd className="font-medium text-ink">{formatKrw(order.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>이용 기간</dt>
                <dd className="text-right">
                  {order.startsAt && order.endsAt
                    ? `${formatDate(order.startsAt)} ~ ${formatDate(order.endsAt)}`
                    : `${order.months}개월`}
                </dd>
              </div>
              {order.method && (
                <div className="flex justify-between gap-3">
                  <dt>결제 수단</dt>
                  <dd>{order.method}</dd>
                </div>
              )}
              {order.failReason && (
                <div className="flex justify-between gap-3">
                  <dt>실패 사유</dt>
                  <dd className="max-w-[60%] text-right">{order.failReason}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt>주문번호</dt>
                <dd className="max-w-[60%] truncate text-right">{order.orderCode}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      {error && <p className="mt-4 text-center text-sm text-brand-600">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-4 h-12 w-full rounded-2xl border border-line text-sm font-medium text-ink-sub active:bg-canvas disabled:opacity-60"
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-sub">
        환불은 고객센터(spectrum.mesh@gmail.com)로 문의해 주세요.
      </p>
    </div>
  );
}
