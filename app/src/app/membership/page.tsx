import { redirect } from 'next/navigation';
import { MembershipScreen } from '@/components/membership-screen';
import { getSession } from '@/lib/auth';
import { getMembershipPlans } from '@/lib/memberships';
import { internalPath } from '@/lib/utils';

export const metadata = { title: '회원권 구매 · Picky' };

// 판매 상태·이용 기간이 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 회원권 구매 화면 — 들어오는 길이 둘이다.
 * 마이페이지의 '회원권 구매' 메뉴, 그리고 콜라주에서 잠긴 유료 템플릿을 눌렀을 때.
 * 화면은 하나(`MembershipScreen`)로 같고, 다른 것은 결제 후 돌아갈 곳뿐이다.
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

  const plans = await getMembershipPlans();

  // 구매자 정보는 결제 화면이 세션에서 직접 읽는다 — 여기서는 고르기만 한다.
  return <MembershipScreen plans={plans} returnTo={internalPath(returnTo, '/collage')} />;
}
