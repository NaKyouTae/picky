import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { formatNoticeDate } from '@/lib/notice-format';
import { getNotice } from '@/lib/notices';

export const metadata = { title: '공지사항 · Picky' };

// 공지는 어드민에서 수시로 고치므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 공지사항 본문 — 목록과 같은 다크 터미널 톤이다.
 *
 * 본문은 서식 없는 글이라 줄바꿈만 살려(`whitespace-pre-line`) 그린다 —
 * 관리자가 쓰는 글이지만 HTML 로 해석하지 않는다.
 */
export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/');

  const { id } = await params;
  const notice = await getNotice(id);
  // 공개되지 않은(작성 중·보관·예약) 공지는 서버가 404 를 준다 — 주소를 알아도 열리지 않는다.
  if (!notice) notFound();

  return (
    <div
      className="flex flex-1 flex-col bg-night px-5 font-mono text-night-text"
      // 다크 화면이라 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다 (마이페이지와 같은 처리).
      // 아래 여백 54px 은 디자인의 '홈 인디케이터 34px + 그 위 20px' 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'calc(max(var(--safe-bottom), 34px) + 20px)',
      }}
    >
      {/* 공지가 길면 끝까지 내려갔을 때 뒤로가기가 사라진다 — 약관 화면처럼 헤더를 붙여 둔다.
          -mx-5 + px-5 는 배경을 좌우 여백까지 채워 본문이 헤더 옆으로 비치지 않게 한다. */}
      <header
        className="sticky z-30 -mx-5 flex h-14 shrink-0 items-center bg-night px-5"
        style={{ top: 'var(--safe-top)' }}
      >
        <Link
          href="/mypage/notices"
          aria-label="뒤로가기"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center active:opacity-60"
        >
          {/* 색(main)이 SVG 에 박혀 있어 CSS 로 바꿀 수 없다 — 파일을 그대로 쓴다 */}
          <Image src="/arrow-back.svg" alt="" width={28} height={28} unoptimized />
        </Link>

        <h1 className="flex-1 truncate text-center text-[20px] leading-none">공지사항</h1>

        <span aria-hidden className="-mr-2 size-11 shrink-0" />
      </header>

      <article className="flex flex-col gap-6 pt-6">
        <div className="flex flex-col gap-2.5">
          {notice.isPinned && (
            <span className="self-start bg-picky-red p-1 text-[12px] leading-none">중요</span>
          )}
          <h2 className="text-[20px] font-medium leading-[1.4]">{notice.title}</h2>
          <p className="text-[14px] leading-none text-night-sub">
            {formatNoticeDate(notice.publishedAt)}
          </p>
        </div>

        <div
          aria-hidden
          className="h-px w-full shrink-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, var(--color-night-raised) 0 2px, transparent 2px 4px)',
          }}
        />

        <p className="whitespace-pre-line text-[14px] leading-[1.6] text-night-sub">
          {notice.content}
        </p>
      </article>
    </div>
  );
}
