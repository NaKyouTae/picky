import { redirect } from 'next/navigation';
import { MembershipOrderList } from '@/components/membership-order-list';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { formatDate } from '@/lib/membership-format';
import { getMyMembership, getMyOrders } from '@/lib/memberships';

export const metadata = { title: '결제 내역 · Picky' };

// 결제할 때마다 늘어나므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const [first, membership] = await Promise.all([getMyOrders(), getMyMembership()]);

  return (
    <div className="pb-page flex flex-1 flex-col">
      <PageHeader title="결제 내역" />

      {membership.active && membership.endsAt && (
        <p className="mx-5 mt-2 rounded-xl bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-600">
          {formatDate(membership.endsAt)}까지 유료 템플릿을 쓸 수 있어요
        </p>
      )}

      <MembershipOrderList first={first} />
    </div>
  );
}
