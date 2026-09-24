import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChallengeHistoryList } from '@/components/challenge-history-list';
import { getSession } from '@/lib/auth';
import { getChallengeHistory } from '@/lib/challenge-groups';
import { getMyMembership } from '@/lib/memberships';

export const metadata = { title: '완료한 챌린지 · Picky' };

// 내역은 완료할 때마다 늘어나므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 완료한 챌린지 — 디자인(Figma 4694:4625, 빈 화면 4694:5139)은 마이페이지와 같은 다크 터미널 톤이다.
 *
 * 헤더 아래 24px, 그 안에서 콜라주 칸이 2열(10px)로 깔린다.
 */
export default async function ChallengeHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/');

  // 회원권 상태는 내려받기 버튼의 갈림길에만 쓴다 (무료면 구매 화면으로 보낸다).
  const [first, membership] = await Promise.all([getChallengeHistory(), getMyMembership()]);

  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      // 다크 화면이라 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다 —
      // 그러지 않으면 노치 영역만 셸의 흰 배경으로 남는다 (마이페이지와 같은 처리).
      // 아래 여백은 모든 화면과 같은 20px 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--page-bottom)',
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

        <h1 className="flex-1 text-center text-[20px] leading-none">완료한 챌린지</h1>

        {/* 디자인의 오른쪽 닫기 아이콘은 보이지 않는다 — 제목이 가운데 오도록 자리만 잡는다 */}
        <span aria-hidden className="-mr-2 size-11 shrink-0" />
      </header>

      <ChallengeHistoryList first={first} membershipActive={membership.active} />
    </div>
  );
}
