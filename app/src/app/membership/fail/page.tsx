import { redirect } from 'next/navigation';
import { MembershipFail } from '@/components/membership-fail';
import { NightScreen } from '@/components/night-screen';
import { getSession } from '@/lib/auth';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '결제 실패 · Picky' };

export const dynamic = 'force-dynamic';

/** 토스 결제창이 실패·중단되면 돌아오는 화면 (code·message·orderId 가 쿼리로 온다) */
export default async function MembershipFailPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; message?: string; orderId?: string; returnTo?: string }>;
}) {
  const [session, { code, message, orderId, returnTo }] = await Promise.all([
    getSession(),
    searchParams,
  ]);
  if (!session) redirect('/');

  return (
    <NightScreen title="결제 실패" closeHref="/">
      <MembershipFail
        orderId={orderId ?? null}
        code={code ?? null}
        message={message ?? null}
        returnTo={internalPath(returnTo, '/collage')}
      />
    </NightScreen>
  );
}
