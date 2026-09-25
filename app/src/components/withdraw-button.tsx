'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal, type DialogState } from '@/components/modal';
import { HOME_PATH } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * 모달 안의 버튼은 전부 같은 모양이다 — 52px 높이, 8px 라운드, 16px 중간 굵기
 * (디자인 4694:5415). 색만 NEUTRAL / POINT 로 갈린다.
 *
 * 초점 링은 평소 디자인을 건드리지 않고 키보드로 들어왔을 때만 보인다.
 */
const BUTTON_BASE =
  'flex h-13 items-center justify-center rounded-lg px-5 text-[16px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night-text/70 focus-visible:ring-offset-2 focus-visible:ring-offset-night-card disabled:opacity-60';
const NEUTRAL = 'bg-night-raised text-night-text active:bg-night-raised/80';
const POINT = 'bg-point text-night active:bg-point/80';

/**
 * 우리가 끊지 못했을 때 사용자가 직접 해제할 수 있는 곳.
 *
 * 여기 없는 제공자는 안내가 통째로 생략되므로, 서버가 manualDisconnect 로 내보내는
 * 제공자는 모두 들어 있어야 한다.
 */
const DISCONNECT_GUIDE: Record<string, { label: string; href: string; hint: string }> = {
  KAKAO: {
    label: '카카오',
    href: 'https://accounts.kakao.com/weblogin/account/partner',
    hint: '연결된 서비스 관리',
  },
  NAVER: {
    label: '네이버',
    // 네이버는 연결 관리 화면으로 바로 가는 공개 주소가 없어 내정보 홈으로 보낸다.
    href: 'https://nid.naver.com/',
    hint: '보안설정 > 연결된 서비스 관리',
  },
  APPLE: {
    label: 'Apple',
    href: 'https://account.apple.com/account/manage',
    hint: '로그인 및 보안 > Apple로 로그인',
  },
};

/**
 * 회원 탈퇴 — 되돌릴 수 없는 조작이라 확인 모달을 거친다.
 * 세션 쿠키는 httpOnly 라 서버 라우트에서만 지울 수 있다 (로그아웃과 같다).
 *
 * 모달은 마이페이지와 같은 다크 터미널 톤이다 (디자인 4694:5409).
 */
export function WithdrawButton() {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>('closed');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 탈퇴는 끝났지만 제공자 연결을 못 끊은 경우 — 직접 해제하도록 안내한다 */
  const [manual, setManual] = useState<string[] | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);

    const res = await fetch('/api/auth/withdraw', { method: 'POST' }).catch(() => null);

    if (!res?.ok) {
      setPending(false);
      setError('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }

    const { manualDisconnect = [] } = (await res.json().catch(() => ({}))) as {
      manualDisconnect?: string[];
    };
    const guided = manualDisconnect.filter((provider) => provider in DISCONNECT_GUIDE);

    // 직접 해제할 곳이 있으면 안내를 읽을 시간을 준 뒤 사용자가 닫게 한다.
    if (guided.length > 0) {
      setPending(false);
      setManual(guided);
      return;
    }

    goHome();
  }

  function goHome() {
    // 마이페이지는 세션이 없으면 홈으로 보내지만, 뒤로 가기로 돌아오지 않도록 replace 한다.
    router.replace(HOME_PATH);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialog('open')}
        aria-haspopup="dialog"
        className="py-2 text-left text-[14px] leading-none text-night-sub active:text-night-text"
      >
        회원탈퇴
      </button>

      <Modal
        state={dialog}
        onRequestClose={() => {
          // 처리 중이거나 안내를 읽는 중에는 배경 탭으로 닫지 않는다.
          if (!pending && !manual) setDialog('closing');
        }}
        onClosed={() => {
          setDialog('closed');
          setError(null);
        }}
        labelledBy="withdraw-title"
        describedBy="withdraw-desc"
        // 디자인 4694:5411 — gray700 카드, 20px 안쪽 여백, 16px 라운드.
        panelClassName="overflow-hidden bg-night-card p-5 font-mono text-night-text"
        overlayClassName="bg-black/60"
        containerClassName="px-5"
      >
        {manual ? (
          <>
            <div className="flex flex-col gap-2.5 py-2 text-center [word-break:keep-all]">
              <h2 id="withdraw-title" className="text-[16px] leading-none">
                탈퇴가 완료됐어요
              </h2>
              <p id="withdraw-desc" className="text-[14px] leading-[1.6] text-night-sub">
                다만 {manual.map((p) => DISCONNECT_GUIDE[p].label).join('·')} 계정에 남은 picky
                연결은 저희가 끊지 못했어요. 아래에서 직접 해제해 주세요. 이미 해제하셨다면 그대로
                두셔도 돼요.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {manual.map((provider) => (
                <a
                  key={provider}
                  href={DISCONNECT_GUIDE[provider].href}
                  target="_blank"
                  rel="noreferrer"
                  // 경로 안내("보안설정 > 연결된 서비스 관리")가 한 줄에는 안 들어간다 —
                  // 이름 아래로 내리고 높이는 52px 를 최소값으로만 잡는다.
                  className={cn(BUTTON_BASE, NEUTRAL, 'h-auto min-h-13 flex-col gap-1 py-2.5')}
                >
                  {DISCONNECT_GUIDE[provider].label} 연결 해제
                  <span className="text-[12px] font-normal leading-[1.4] text-night-sub">
                    {DISCONNECT_GUIDE[provider].hint}
                  </span>
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={goHome}
              autoFocus
              className={cn(BUTTON_BASE, POINT, 'mt-2.5 w-full')}
            >
              확인
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 py-2 text-center [word-break:keep-all]">
              <h2 id="withdraw-title" className="text-[16px] leading-none">
                정말 탈퇴하시겠어요?
              </h2>
              <p id="withdraw-desc" className="text-[14px] leading-[1.6] text-night-sub">
                쌓아온 챌린지 기록이 모두 사라져요.
                <br />
                삭제된 기록은 다시 복구할 수 없어요.
              </p>
            </div>

            {/* 실패하면 팝업이 열린 채로 남는다 — 이유를 버튼 바로 위에서 보여준다 */}
            {error && (
              <p
                role="alert"
                className="mt-2.5 text-center text-[12px] leading-[1.6] text-[#ff6b66] [word-break:keep-all]"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setDialog('closing')}
                disabled={pending}
                // 되돌릴 수 없는 쪽이 아니라 취소에 처음 초점을 준다.
                autoFocus
                className={cn(BUTTON_BASE, NEUTRAL, 'flex-1')}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void withdraw()}
                disabled={pending}
                aria-busy={pending}
                className={cn(BUTTON_BASE, POINT, 'flex-1 gap-2')}
              >
                {/* 글자를 바꾸지 않아 버튼 폭이 흔들리지 않는다 */}
                {pending && (
                  <span
                    aria-hidden
                    className="size-4 shrink-0 animate-spin rounded-full border-2 border-night/25 border-t-night"
                  />
                )}
                탈퇴하기
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
