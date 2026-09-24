import { redirect } from 'next/navigation';
import { MembershipCheckout } from '@/components/membership-checkout';
import { NightScreen } from '@/components/night-screen';
import { getSession } from '@/lib/auth';
import { getMembershipPlans } from '@/lib/memberships';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '결제 · Picky' };

// 판매 상태·금액이 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 결제 화면 (디자인 4694:5823) — 회원권 화면에서 고른 플랜으로 결제를 진행한다.
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

  // 배경은 night(#121212) 그대로 둔다 — 토스 위젯이 다크 UI 에서 칠하는 색과 같은 값이라
  // 경계가 드러나지 않는다. (개발 중 보이는 '테스트 환경' 안내 배너만 조금 밝은 칸으로 뜨는데,
  // 그 배너는 테스트 키에서만 나오고 운영에서는 사라진다)
  //
  // 닫기(X)는 두지 않는다 — 여기서 빠져나가는 길은 뒤로가기(회원권 고르기) 하나면 된다
  // (결제를 마친 '결제 완료' 화면에는 디자인대로 닫기를 둔다).
  return (
    <NightScreen title="결제" backHref="/membership">
      <MembershipCheckout
        plan={plan}
        customerKey={session.id}
        customerName={session.name}
        customerEmail={session.email}
        returnTo={internalPath(returnTo, '/collage')}
      />
    </NightScreen>
  );
}
