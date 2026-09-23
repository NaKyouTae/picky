'use client';

import { useCallback, useState } from 'react';
import { SparkleMark } from '@/components/sparkle-mark';
import {
  MEMBERSHIP_ORDER_STATUS_LABELS,
  MEMBERSHIP_REFUND_NOTES,
  MEMBERSHIP_STORE_LABELS,
  formatDate,
  formatDateTime,
  formatKrw,
} from '@/lib/membership-format';
import type { MembershipOrder, MembershipOrderPage } from '@/lib/memberships';
import { cn } from '@/lib/utils';

/**
 * 상태 배지 — 디자인에는 강조(빨강)와 무채색 두 가지뿐이다.
 * 이용 기간이 실제로 생긴 결제만 강조하고, 나머지는 한 단 밝은 표면색으로 둔다.
 */
const STATUS_STYLES: Record<MembershipOrder['status'], string> = {
  PAID: 'bg-picky-red',
  PENDING: 'bg-night-raised',
  FAILED: 'bg-night-raised',
  // 환불은 이용 기간이 회수된 상태다 — 강조하지 않는다.
  REFUNDED: 'bg-night-raised',
};

/**
 * 내 결제 내역 — 디자인(Figma 4692:4324, 빈 화면 4693:4395)의 다크 카드.
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
    // 디자인의 빈 화면 — 남은 높이 가운데에 마크와 문구만 둔다 (버튼 없음).
    // 회원권을 사러 가는 입구는 바로 앞 화면인 마이페이지의 '회원권 구매' 다.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-9 text-center">
        <SparkleMark />
        <p className="text-[16px] font-medium leading-[1.6]">
          Picky Pro 회원권으로
          <br />더 즐겁게 Picky를 즐겨보세요 !
        </p>
        <p className="text-[14px] leading-[1.6] text-night-sub">아직 결제 내역이 없어요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-2.5">
        {orders.map((order) => (
          <li key={order.id} className="flex flex-col gap-4 rounded-lg bg-night-card p-5">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-[16px] font-medium leading-none">
                  {order.planName}
                </p>
                <span
                  className={cn(
                    'shrink-0 p-1 text-[12px] leading-none',
                    STATUS_STYLES[order.status],
                  )}
                >
                  {MEMBERSHIP_ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              <p className="text-[14px] font-medium leading-none text-night-sub">
                {formatDateTime(order.paidAt ?? order.createdAt)}
              </p>
            </div>

            <Divider />

            <dl className="flex flex-col gap-2.5 text-[12px] leading-none">
              <Row label="결제 금액" value={formatKrw(order.amount)} />
              <Row
                label="이용 기간"
                value={
                  order.startsAt && order.endsAt
                    ? `${formatDate(order.startsAt)}-${formatDate(order.endsAt)}`
                    : `${order.months}개월`
                }
              />
              <Row label="결제처" value={MEMBERSHIP_STORE_LABELS[order.store]} />
              {order.refundedAt && (
                <Row label="환불 일시" value={formatDateTime(order.refundedAt)} />
              )}
              {order.method && <Row label="결제 수단" value={order.method} />}
              {/* 디자인에 없는 행 — 실패한 주문은 이유를 보여 주지 않으면 문의할 거리가 없다 */}
              {order.failReason && <Row label="실패 사유" value={order.failReason} />}
              <Row label="주문 번호" value={order.orderCode} />
            </dl>

            {/* 환불 창구가 스토어마다 다르다. 인앱결제는 우리가 취소할 수 없으므로
                고객센터로 헛걸음하지 않게 결제가 된 건에 한해 안내한다. */}
            {order.status === 'PAID' && MEMBERSHIP_REFUND_NOTES[order.store] && (
              <p className="text-[12px] leading-[1.5] text-night-sub">
                {MEMBERSHIP_REFUND_NOTES[order.store]}
              </p>
            )}
          </li>
        ))}
      </ol>

      {error && <p className="mt-2 text-center text-[12px] text-picky-red">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-2 h-12 w-full rounded-lg border border-night-raised text-[14px] text-night-sub active:bg-night-card disabled:opacity-60"
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}

      <p className="mt-2 text-center text-[12px] leading-[1.6] text-night-sub">
        환불은 고객센터(spectrum.mesh@gmail.com)로 문의해 주세요.
      </p>
    </div>
  );
}

/**
 * 라벨 + 값 한 줄.
 *
 * 디자인의 라벨-값 간격은 40px 이지만, 값이 오른쪽 정렬이라 간격이 넓을수록
 * 값이 쓸 수 있는 폭만 줄어든다 (좁은 폰에서 이용 기간이 잘린다).
 * 보이는 모습은 그대로 두고 최소 간격만 남긴다.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="shrink-0 text-night-sub">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-right">{value}</dd>
    </div>
  );
}

/** 디자인의 점선 구분선 — 2px 대시·2px 간격(Figma Line 11) */
function Divider() {
  return (
    <div
      aria-hidden
      className="h-px w-full shrink-0"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to right, var(--color-night-raised) 0 2px, transparent 2px 4px)',
      }}
    />
  );
}
