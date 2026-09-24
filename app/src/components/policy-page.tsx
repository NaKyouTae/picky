import Image from 'next/image';
import Link from 'next/link';

/**
 * 약관·정책 문서 화면의 공통 껍데기 —
 * 디자인(Figma 4694:4689 · 4694:5037 · 4694:5177 · 4694:5250)은 마이페이지·결제 내역과 같은
 * 다크 터미널 톤이다.
 *
 * 헤더(56px) 아래 24px, 섹션끼리 24px, 섹션 안에서 제목과 본문은 10px 간격이다.
 */
export function PolicyPage({
  title,
  effectiveDate,
  addendum,
  children,
}: {
  title: string;
  /** 오른쪽 위 시행일자 — '2026년 9월 21일' 처럼 날짜만 준다 */
  effectiveDate: string;
  /** 문서 끝의 부칙 한 줄 */
  addendum?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-1 flex-col bg-night px-5 font-mono text-night-text"
      // 다크 화면이라 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다 —
      // 그러지 않으면 노치 영역만 셸의 흰 배경으로 남는다 (마이페이지와 같은 처리).
      // 아래 여백은 모든 화면과 같은 20px 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--page-bottom)',
      }}
    >
      {/* 약관은 화면 몇 개 분량이라 끝까지 내려가면 뒤로가기가 사라진다 — 헤더만 붙여 둔다.
          셸이 준 safe-top 만큼 내려 붙여야 스크롤 시 노치에 가리지 않는다.
          -mx-5 + px-5 는 배경을 좌우 여백까지 채워 본문이 헤더 옆으로 비치지 않게 한다. */}
      <header
        className="sticky z-30 -mx-5 flex h-14 shrink-0 items-center bg-night px-5"
        style={{ top: 'var(--safe-top)' }}
      >
        <Link
          href="/mypage"
          aria-label="뒤로가기"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center active:opacity-60"
        >
          {/* 색(main)이 SVG 에 박혀 있어 CSS 로 바꿀 수 없다 — 파일을 그대로 쓴다 */}
          <Image src="/arrow-back.svg" alt="" width={28} height={28} unoptimized />
        </Link>

        <h1 className="flex-1 truncate text-center text-[20px] leading-none">{title}</h1>

        {/* 디자인의 오른쪽 닫기 아이콘은 보이지 않는다 — 제목이 가운데 오도록 자리만 잡는다 */}
        <span aria-hidden className="-mr-2 size-11 shrink-0" />
      </header>

      <article className="flex flex-col gap-6 pt-6 text-[14px] leading-[1.4] text-night-sub">
        <p className="text-right text-[12px] leading-[18px]">시행일자: {effectiveDate}</p>

        {children}

        {addendum && <p className="text-center text-[12px] leading-[18px]">{addendum}</p>}
      </article>
    </div>
  );
}

/** 제목 + 본문 한 덩어리. 제목 없이 문단만 묶을 때도 쓴다. */
export function PolicySection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      {title && <h2 className="text-[14px] font-medium leading-5 text-night-text">{title}</h2>}
      {children}
    </section>
  );
}
