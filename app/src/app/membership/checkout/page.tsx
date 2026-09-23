import { redirect } from 'next/navigation';
import { MembershipCheckout } from '@/components/membership-checkout';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getMembershipPlans } from '@/lib/memberships';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '결제 · Picky' };

// 판매 상태·금액이 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 결제 화면 — 회원권 화면에서 고른 플랜으로 결제를 진행한다.
 *
 * 금액은 쿼리로 받지 않고 planId 로 서버에서 다시 읽는다 (클라이언트가 보낸 금액을 믿지 않는다).
 * 판매가 끝났거나 없는 회원권이면 고르는 화면으로 되돌린다.
 *
 * 앱에서는 이 주소로 직접 들어와도 토스 결제위젯이 뜨지 않는다 —
 * `MembershipCheckout` 이 인앱결제로 갈아끼운다 (App Review Guideline 3.1.1).
 */
export default async function MembershipCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; returnTo?: string }>;
}) {
  const [session, { planId, returnTo }] = await Promise.all([getSession(), searchParams]);
  if (!session) redirect('/');

  const plans = await getMembershipPlans();
  const plan = plans.find((item) => item.id === planId);
  if (!plan) redirect('/membership');

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="결제" variant="back" href="/membership" />
      <MembershipCheckout
        plan={plan}
        customerKey={session.id}
        customerName={session.name}
        customerEmail={session.email}
        returnTo={internalPath(returnTo, '/collage')}
      />
    </div>
  );
}
