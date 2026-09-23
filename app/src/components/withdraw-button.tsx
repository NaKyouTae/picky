'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal, type DialogState } from '@/components/modal';
import { HOME_PATH } from '@/lib/constants';

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
};

/**
 * 회원 탈퇴 — 되돌릴 수 없는 조작이라 확인 모달을 거친다.
 * 세션 쿠키는 httpOnly 라 서버 라우트에서만 지울 수 있다 (로그아웃과 같다).
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
      >
        {manual ? (
          <>
            <h2 id="withdraw-title" className="text-base font-bold">
              탈퇴가 완료됐어요
            </h2>
            <p className="mt-1.5 text-sm text-ink-sub">
              다만 {manual.map((p) => DISCONNECT_GUIDE[p].label).join('·')} 계정에 남은 picky 연결은
              저희가 끊지 못했어요. 아래에서 직접 해제해 주세요. 이미 해제하셨다면 그대로 두셔도
              돼요.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {manual.map((provider) => (
                <a
                  key={provider}
                  href={DISCONNECT_GUIDE[provider].href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center justify-center rounded-2xl border border-line text-sm font-medium underline underline-offset-4"
                >
                  {DISCONNECT_GUIDE[provider].label} 연결 해제하러 가기
                  <span className="ml-1 text-xs font-normal text-ink-sub no-underline">
                    ({DISCONNECT_GUIDE[provider].hint})
                  </span>
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={goHome}
              className="mt-6 h-12 w-full rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
            >
              확인
            </button>
          </>
        ) : (
          <>
            <h2 id="withdraw-title" className="text-base font-bold">
              정말 탈퇴하시겠어요?
            </h2>
            <p className="mt-1.5 text-sm text-ink-sub">
              완료한 챌린지 기록과 인증 사진이 모두 삭제되고 복구할 수 없어요. 남은 회원권 기간이
              있어도 함께 사라져요.
            </p>

            {error && (
              <p role="alert" className="mt-3 text-xs text-ink-sub">
                {error}
              </p>
            )}

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => void withdraw()}
                disabled={pending}
                className="h-12 w-full rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600 disabled:opacity-60"
              >
                {pending ? '탈퇴 처리 중…' : '탈퇴하기'}
              </button>
              <button
                type="button"
                onClick={() => setDialog('closing')}
                disabled={pending}
                className="h-12 w-full rounded-2xl border border-line bg-white text-base font-semibold text-ink active:bg-canvas disabled:opacity-60"
              >
                취소
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
