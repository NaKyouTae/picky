import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MembershipConfirm } from '@/components/membership-confirm';
import { MEMBERSHIP_CTA_CLASS } from '@/components/membership-cta-bar';
import { NightNotice, NightScreen } from '@/components/night-screen';
import { getSession } from '@/lib/auth';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '결제 완료 · Picky' };

export const dynamic = 'force-dynamic';

/**
 * 토스 결제창이 성공하면 돌아오는 화면 (디자인 4694:5860).
 * 쿼리로 오는 paymentKey·orderId·amount 를 그대로 서버에 넘겨 승인을 받는다
 * (승인 전까지 결제는 확정된 것이 아니다).
 */
export default async function MembershipSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    paymentKey?: string;
    orderId?: string;
    amount?: string;
    returnTo?: string;
  }>;
}) {
  const [session, { paymentKey, orderId, amount, returnTo }] = await Promise.all([
    getSession(),
    searchParams,
  ]);
  if (!session) redirect('/');

  const value = Number(amount);

  // 결제창을 거치지 않고 들어온 경우 — 승인할 것이 없다.
  if (!paymentKey || !orderId || !Number.isInteger(value)) {
    return (
      <NightScreen title="결제 완료" closeHref="/">
        <NightNotice
          grow
          title="결제 정보를 찾을 수 없어요"
          description="회원권 화면에서 다시 시도해 주세요."
        />
        <Link href="/membership" className={MEMBERSHIP_CTA_CLASS}>
          회원권 보기
        </Link>
      </NightScreen>
    );
  }

  return (
    <NightScreen title="결제 완료" closeHref="/">
      <MembershipConfirm
        paymentKey={paymentKey}
        orderId={orderId}
        amount={value}
        returnTo={internalPath(returnTo, '/collage')}
      />
    </NightScreen>
  );
}
