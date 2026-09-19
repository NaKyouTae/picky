'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CategoryGrid } from '@/components/category-grid';
import { GoogleLoginButton } from '@/components/google-login-button';
import { KakaoLoginButton } from '@/components/kakao-login-button';
import { Modal, type DialogState } from '@/components/modal';
import { type ChallengeCategory, type ChallengeCategorySummary } from '@/lib/challenges';

/**
 * '챌린지 시작하기' 버튼.
 * 로그인 상태면 카테고리 선택 모달을, 아니면 로그인 모달을 띄운다.
 * 세션 판정은 서버 컴포넌트가 하고(쿠키 유효성까지 NestJS 가 확인) 여기서는 결과만 받는다.
 */
export function ChallengeStartButton({
  loggedIn,
  summary,
}: {
  loggedIn: boolean;
  summary: ChallengeCategorySummary[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>('closed');
  const counts = new Map(summary.map((row) => [row.category, row.count]));

  function handleSelect(category: ChallengeCategory) {
    // 뽑기는 챌린지 화면에서 바로 시작된다 (쿼리로 카테고리를 넘긴다).
    router.push(`/challenge?category=${category}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialog('open')}
        aria-haspopup="dialog"
        aria-expanded={dialog !== 'closed'}
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
      >
        챌린지 시작하기
      </button>

      <Modal
        state={dialog}
        onRequestClose={() => setDialog('closing')}
        onClosed={() => setDialog('closed')}
        labelledBy="challenge-start-dialog-title"
      >
        {loggedIn ? (
          <>
            <h2 id="challenge-start-dialog-title" className="text-base font-bold">
              누구와 함께할까요?
            </h2>
            <p className="mt-1.5 text-sm text-ink-sub">고르면 챌린지를 하나 뽑아 드려요.</p>

            <div className="mt-5">
              <CategoryGrid counts={counts} onSelect={handleSelect} />
            </div>

            <button
              type="button"
              onClick={() => setDialog('closing')}
              className="mt-5 h-11 w-full text-sm font-medium text-ink-sub"
            >
              닫기
            </button>
          </>
        ) : (
          <div className="text-center">
            <h2 id="challenge-start-dialog-title" className="text-base font-bold">
              로그인이 필요해요
            </h2>
            <p className="mt-1.5 text-sm text-ink-sub">로그인하면 챌린지 기록이 저장돼요.</p>

            <div className="mt-6 flex items-center justify-center gap-4">
              <KakaoLoginButton />
              <GoogleLoginButton />
            </div>

            <button
              type="button"
              onClick={() => setDialog('closing')}
              className="mt-6 h-11 w-full text-sm font-medium text-ink-sub"
            >
              다음에 할게요
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
