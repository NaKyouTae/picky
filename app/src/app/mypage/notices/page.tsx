import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NoticeList } from '@/components/notice-list';
import { getSession } from '@/lib/auth';
import { getNotices } from '@/lib/notices';

export const metadata = { title: '공지사항 · Picky' };

// 공지는 어드민에서 수시로 올리므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 공지사항 — 마이페이지·결제 내역과 같은 다크 터미널 톤이다.
 * 헤더 아래 24px, 그 안에서 카드가 10px 간격으로 쌓인다.
 */
export default async function NoticesPage() {
  // 공지 자체는 누구나 볼 수 있는 내용이지만, 들어오는 입구가 마이페이지뿐이라
  // 다른 마이페이지 화면과 같게 맞춘다 (로그인하지 않았으면 홈으로).
  const session = await getSession();
  if (!session) redirect('/');

  const first = await getNotices();

  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      // 다크 화면이라 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다 —
      // 그러지 않으면 노치 영역만 셸의 흰 배경으로 남는다 (마이페이지와 같은 처리).
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

        <h1 className="flex-1 text-center text-[20px] leading-none">공지사항</h1>

        {/* 제목이 가운데 오도록 뒤로가기와 같은 크기의 빈 자리를 둔다 */}
        <span aria-hidden className="-mr-2 size-11 shrink-0" />
      </header>

      <div className="flex flex-1 flex-col">
        <NoticeList first={first} />
      </div>
    </div>
  );
}
