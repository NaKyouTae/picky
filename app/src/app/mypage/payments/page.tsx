import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MembershipOrderList } from '@/components/membership-order-list';
import { getSession } from '@/lib/auth';
import { formatDate } from '@/lib/membership-format';
import { getMyMembership, getMyOrders } from '@/lib/memberships';

export const metadata = { title: '결제 내역 · Picky' };

// 결제할 때마다 늘어나므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 결제 내역 — 디자인(Figma 4692:4324, 빈 화면 4693:4395)은 마이페이지와 같은 다크 터미널 톤이다.
 *
 * 헤더 아래 24px, 그 안에서 혜택 배너와 카드가 10px 간격으로 쌓인다.
 */
export default async function PaymentsPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const [first, membership] = await Promise.all([getMyOrders(), getMyMembership()]);

  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      // 다크 화면이라 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다 —
      // 그러지 않으면 노치 영역만 셸의 흰 배경으로 남는다 (마이페이지와 같은 처리).
      // 아래 여백은 모든 화면과 같은 20px 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: '20px',
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between">
        <Link
          href="/mypage"
          aria-label="뒤로가기"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center active:opacity-60"
        >
          {/* 색(main)이 SVG 에 박혀 있어 CSS 로 바꿀 수 없다 — 파일을 그대로 쓴다 */}
          <Image src="/arrow-back.svg" alt="" width={28} height={28} unoptimized />
        </Link>

        <h1 className="flex-1 text-center text-[20px] leading-none">결제 내역</h1>

        {/* 디자인의 오른쪽 닫기 아이콘은 보이지 않는다 — 제목이 가운데 오도록 자리만 잡는다 */}
        <span aria-hidden className="-mr-2 size-11 shrink-0" />
      </header>

      <div className="flex flex-1 flex-col gap-2.5">
        {membership.active && membership.endsAt && (
          <p className="flex h-9 shrink-0 items-center justify-center rounded-[4px] border border-picky-red px-3 text-center text-[14px] leading-none">
            혜택은 {formatDate(membership.endsAt)}까지 이어져요.
          </p>
        )}

        <MembershipOrderList first={first} />
      </div>
    </div>
  );
}
