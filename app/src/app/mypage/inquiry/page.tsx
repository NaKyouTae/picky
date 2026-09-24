import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { InquiryForm } from '@/components/inquiry-form';
import { getSession } from '@/lib/auth';

export const metadata = { title: '문의하기 · Picky' };

// 로그인 여부에 따라 갈라지므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 마이페이지 > 문의하기 (디자인 4694:5381).
 *
 * 마이페이지·공지사항과 같은 다크 터미널 톤이다. 헤더 아래로 블록이 24px 간격으로 쌓인다.
 * 보낸 뒤의 완료 화면(4694:5634)도 같은 헤더를 쓰므로 폼 쪽에서 상태로만 갈아 끼운다.
 */
export default async function InquiryPage() {
  const session = await getSession();
  if (!session) redirect('/');

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

        <h1 className="flex-1 text-center text-[20px] leading-none">문의하기</h1>

        <Link
          href="/"
          aria-label="닫기"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center text-main active:text-main/70"
        >
          <CloseIcon />
        </Link>
      </header>

      {/* 완료 화면이 남은 높이를 채워 버튼을 아래로 밀 수 있도록 여기서 1을 내려 준다 */}
      <div className="flex flex-1 flex-col">
        <InquiryForm />
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" className="size-7" aria-hidden>
      <path d="M22.1667 7.47833 20.5217 5.83333 14 12.355 7.47833 5.83333 5.83333 7.47833 12.355 14l-6.52167 6.5217 1.645 1.645L14 15.645l6.5217 6.5217 1.645-1.645L15.645 14l6.5217-6.52167Z" />
    </svg>
  );
}
