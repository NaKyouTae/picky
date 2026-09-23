import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MembershipConfirm } from '@/components/membership-confirm';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '결제 확인 · Picky' };

export const dynamic = 'force-dynamic';

/**
 * 토스 결제창이 성공하면 돌아오는 화면.
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
      <div className="flex flex-1 flex-col">
        <PageHeader title="결제 확인" variant="close" href="/membership" />
        <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
          <p className="text-base font-semibold">결제 정보를 찾을 수 없어요</p>
          <p className="mt-2 text-sm text-ink-sub">회원권 화면에서 다시 시도해 주세요.</p>
          <Link
            href="/membership"
            className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
          >
            회원권 보기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="결제 확인" variant="close" href="/membership" />
      <MembershipConfirm
        paymentKey={paymentKey}
        orderId={orderId}
        amount={value}
        returnTo={internalPath(returnTo, '/collage')}
      />
    </div>
  );
}
