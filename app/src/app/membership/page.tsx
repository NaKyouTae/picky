import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MembershipPurchase } from '@/components/membership-purchase';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { formatDate } from '@/lib/membership-format';
import { getMembershipPlans, getMyMembership } from '@/lib/memberships';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '회원권 · Picky' };

// 판매 상태·이용 기간이 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 유료 템플릿을 누르면 오는 화면 — 회원권을 골라 결제한다.
 *
 * `returnTo` 는 결제를 마친 뒤 돌아갈 화면이다 (콜라주에서 왔다면 그 화면으로 돌려보내야
 * 인증 사진이 다시 채워진다). 외부 주소로 새어 나가지 않게 내부 경로만 받는다.
 */
export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [session, { returnTo }] = await Promise.all([getSession(), searchParams]);
  // 결제는 로그인한 사용자만 — 홈에서 로그인 모달을 띄운다.
  if (!session) redirect('/');

  const [plans, membership] = await Promise.all([getMembershipPlans(), getMyMembership()]);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="회원권" variant="back" />

      <section className="px-5 pb-5 pt-2">
        <h1 className="text-lg font-bold leading-snug">
          회원권으로 유료 템플릿을
          <br />
          모두 사용해 보세요
        </h1>

        {membership.active && membership.endsAt ? (
          <p className="mt-3 rounded-xl bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-600">
            {formatDate(membership.endsAt)}까지 이용할 수 있어요
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-sub">
            지금은 무료 템플릿만 쓸 수 있어요. 기간을 고르면 그만큼 유료 템플릿이 열려요.
          </p>
        )}
      </section>

      {/* 구매자 정보는 결제 화면이 세션에서 직접 읽는다 — 여기서는 고르기만 한다 */}
      <MembershipPurchase
        plans={plans}
        membership={membership}
        returnTo={internalPath(returnTo, '/collage')}
      />

      <p className="px-5 pb-6 pt-2 text-center text-xs text-ink-sub">
        <Link href="/mypage/payments" className="underline">
          결제 내역 보기
        </Link>
      </p>
    </div>
  );
}
