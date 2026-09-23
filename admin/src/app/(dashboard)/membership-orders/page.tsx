import { MembershipOrdersTable } from '@/components/membership-orders-table';
import { api } from '@/lib/api';
import type { MembershipOrderSummary } from '@/lib/membership-orders';

// 결제는 계속 쌓이므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

const EMPTY_SUMMARY: MembershipOrderSummary = {
  paidCount: 0,
  paidAmount: 0,
  pendingCount: 0,
  failedCount: 0,
};

export default async function MembershipOrdersPage() {
  const summary = await api
    .get<MembershipOrderSummary>('/admin/membership-orders/summary', { cache: 'no-store' })
    .catch(() => EMPTY_SUMMARY);

  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">결제 내역</h1>
      <p className="mt-2 text-sm text-ink-sub">
        모든 사용자의 회원권 결제 내역입니다. 환불은 토스페이먼츠 콘솔에서 처리합니다.
      </p>
      <div className="mt-6">
        <MembershipOrdersTable summary={summary} />
      </div>
    </div>
  );
}
