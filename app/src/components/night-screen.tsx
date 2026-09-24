import Link from 'next/link';

/**
 * 다크 터미널 톤 화면의 껍데기 — 헤더 + 24px 간격으로 쌓이는 본문.
 *
 * 결제 흐름(결제 · 결제 완료 · 결제 실패)이 같은 껍데기를 쓴다. 디자인(4694:5823 · 4694:5860)의
 * 헤더는 좌우 아이콘 자리를 늘 차지하고 가운데 제목을 두는데, 화면마다 둘 중 하나만 있을 때가
 * 있어서 없는 쪽은 같은 크기의 빈 자리로 남긴다 (그래야 제목이 실제로 가운데 온다).
 *
 * 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다 — 그러지 않으면 노치 영역만
 * 셸의 흰 배경으로 남는다 (마이페이지·회원권 화면과 같은 처리).
 */
export function NightScreen({
  title,
  backHref,
  closeHref,
  children,
}: {
  title: string;
  /** 왼쪽 뒤로가기 — 없으면 자리만 비워 둔다 */
  backHref?: string;
  /** 오른쪽 닫기 — 없으면 자리만 비워 둔다 */
  closeHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--page-bottom)',
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="뒤로가기"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center text-main active:text-main/70"
          >
            <BackIcon />
          </Link>
        ) : (
          <span aria-hidden className="-ml-2 size-11 shrink-0" />
        )}

        <h1 className="flex-1 text-center text-[20px] leading-none">{title}</h1>

        {closeHref ? (
          <Link
            href={closeHref}
            aria-label="닫기"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center text-main active:text-main/70"
          >
            <CloseIcon />
          </Link>
        ) : (
          <span aria-hidden className="-mr-2 size-11 shrink-0" />
        )}
      </header>

      {children}
    </div>
  );
}

/**
 * 별 마크 + 제목 + 보조 문구 한 덩어리 (디자인 4694:5874).
 * 결제 완료·실패처럼 안내 한 장과 버튼만 있는 화면이 쓴다 —
 * `grow` 를 주면 남은 높이를 이 블록이 차지해 버튼이 화면 아래로 내려간다.
 */
export function NightNotice({
  mark,
  title,
  description,
  grow = false,
}: {
  /** 위에 놓을 마크 (완료 화면의 별 등) — 없으면 제목부터 시작한다 */
  mark?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div
      className={`flex w-full flex-col items-center gap-4 py-9 text-center ${grow ? 'flex-1' : ''}`}
    >
      {mark}
      <p className="text-[16px] leading-[1.6]">{title}</p>
      {description && <p className="text-[14px] leading-[1.6] text-night-sub">{description}</p>}
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden>
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" className="size-7" aria-hidden>
      <path d="M22.1667 7.47833 20.5217 5.83333 14 12.355 7.47833 5.83333 5.83333 7.47833 12.355 14l-6.52167 6.5217 1.645 1.645L14 15.645l6.5217 6.5217 1.645-1.645L15.645 14l6.5217-6.52167Z" />
    </svg>
  );
}
