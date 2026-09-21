'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GoogleLoginButton } from '@/components/google-login-button';
import { KakaoLoginButton } from '@/components/kakao-login-button';
import { ChallengeDrawOverlay, startMinimumDraw } from '@/components/challenge-draw-overlay';
import { Modal, type DialogState } from '@/components/modal';
import type { ChallengeCategory, ChallengeGroup } from '@/lib/challenges';
import { cn } from '@/lib/utils';

/**
 * 메인 화면의 카테고리 목록.
 *
 * 카테고리를 고르는 것이 곧 챌린지 그룹 생성이다 — 별도 시작 버튼이 없다.
 * 진행 중인 그룹이 있으면 이어서 할지 새로 시작할지 먼저 묻는다.
 * 세션 판정은 서버 컴포넌트가 하고(쿠키 유효성까지 NestJS 가 확인) 여기서는 결과만 받는다.
 */
export function CategoryList({
  categories,
  loggedIn,
  activeGroup,
}: {
  categories: ChallengeCategory[];
  loggedIn: boolean;
  activeGroup: ChallengeGroup | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>('closed');
  /** 어떤 카테고리를 누르다 막혔는지 — 모달에서 '새로 시작' 을 고르면 이걸로 재시도한다 */
  const [picked, setPicked] = useState<ChallengeCategory | null>(null);
  /** 뽑는 중인 카테고리 — 값이 있으면 전체 화면 두구두구 로딩을 덮는다 */
  const [drawing, setDrawing] = useState<ChallengeCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(category: ChallengeCategory, restart: boolean) {
    setDrawing(category);
    setError(null);
    // 요청 전에 걸어 두고 응답 후에 기다린다 (자세한 이유는 startMinimumDraw 주석 참고).
    const minimumDraw = startMinimumDraw();

    try {
      const res = await fetch('/api/challenge-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: category.id, restart }),
        cache: 'no-store',
      });

      if (res.status === 401 || res.status === 409) {
        setDrawing(null);
        setPicked(category);
        setDialog('open');
        return;
      }
      if (res.status === 404) {
        setDrawing(null);
        setError('이 카테고리는 아직 준비 중이에요.');
        return;
      }
      if (!res.ok) throw new Error();

      // 응답이 너무 빨라 두구두구가 깜빡이고 마는 것을 막는다 (이미 지났으면 바로 통과).
      await minimumDraw;

      // 화면이 넘어갈 때까지 오버레이를 유지해 홈이 잠깐 보이는 일이 없게 한다.
      setDialog('closed');
      router.push('/challenge');
      router.refresh();
    } catch {
      setDrawing(null);
      setError('시작하지 못했어요. 다시 시도해 주세요.');
    }
  }

  function handleClick(category: ChallengeCategory) {
    if (!loggedIn) {
      setPicked(category);
      setDialog('open');
      return;
    }
    // 진행 중인 그룹이 있으면 서버가 409 를 주지만, 이미 알고 있으면 먼저 물어본다.
    if (activeGroup) {
      setPicked(category);
      setDialog('open');
      return;
    }
    void start(category, false);
  }

  return (
    <>
      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-ink-sub">
          아직 준비된 카테고리가 없어요.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {categories.map((category) => {
            const empty = category.challengeCount === 0;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => handleClick(category)}
                  disabled={empty || drawing !== null}
                  className={cn(
                    'flex h-full w-full flex-col items-center gap-1 rounded-2xl border border-line bg-white p-3 text-center active:bg-gray-50',
                    empty && 'opacity-40',
                  )}
                >
                  <span className="text-2xl leading-none">{category.emoji ?? '🎯'}</span>
                  <span className="text-sm font-semibold">{category.name}</span>
                  {category.description && (
                    <span className="line-clamp-2 text-[11px] leading-snug text-ink-sub">
                      {category.description}
                    </span>
                  )}
                  {/* 챌린지가 없는 카테고리는 눌러도 시작할 수 없으니 이유를 표시한다 */}
                  {empty && <span className="text-[11px] text-ink-sub">준비 중</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-3 text-center text-sm text-brand-600">{error}</p>}

      {/* 진행 중인 그룹이 있으면 카테고리 아래에 이어서 하기 버튼을 둔다 */}
      {loggedIn && activeGroup && (
        <Link
          href="/challenge"
          className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
        >
          이어서 챌린지하기
        </Link>
      )}

      <Modal
        state={dialog}
        onRequestClose={() => setDialog('closing')}
        onClosed={() => setDialog('closed')}
        labelledBy="category-dialog-title"
      >
        {!loggedIn ? (
          <div className="text-center">
            <h2 id="category-dialog-title" className="text-base font-bold">
              로그인이 필요해요
            </h2>
            <p className="mt-1.5 text-sm text-ink-sub">로그인하면 챌린지 기록이 저장돼요.</p>

            <div className="mt-6 flex items-center justify-center gap-4">
              <KakaoLoginButton />
              <GoogleLoginButton />
            </div>

            {/* 가입 시점을 필수 동의 시각으로 기록하므로(서버) 여기서 미리 고지한다 */}
            <p className="mt-4 text-xs leading-relaxed text-ink-sub">
              로그인하면{' '}
              <Link href="/mypage/terms" className="underline underline-offset-2">
                이용약관
              </Link>
              과{' '}
              <Link href="/mypage/privacy" className="underline underline-offset-2">
                개인정보처리방침
              </Link>
              에 동의하는 것으로 봅니다.
            </p>

            <button
              type="button"
              onClick={() => setDialog('closing')}
              className="mt-6 h-11 w-full text-sm font-medium text-ink-sub"
            >
              다음에 할게요
            </button>
          </div>
        ) : (
          <>
            <h2 id="category-dialog-title" className="text-base font-bold">
              이미 진행 중인 챌린지가 있어요
            </h2>
            <p className="mt-1.5 text-sm text-ink-sub">
              {activeGroup
                ? `${activeGroup.category.name} · 챌린지 ${activeGroup.items.length}개 진행 중`
                : '진행 중인 챌린지가 있어요.'}
            </p>

            <div className="mt-6 space-y-2">
              <Link
                href="/challenge"
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
              >
                이어서 하기
              </Link>
              <button
                type="button"
                onClick={() => picked && void start(picked, true)}
                disabled={drawing !== null || !picked}
                className="h-12 w-full rounded-2xl border border-line bg-white text-base font-semibold text-ink active:bg-gray-50 disabled:opacity-60"
              >
                {`새로 시작하기${picked ? ` (${picked.name})` : ''}`}
              </button>
            </div>

            {error && <p className="mt-4 text-center text-sm text-brand-600">{error}</p>}

            <button
              type="button"
              onClick={() => setDialog('closing')}
              className="mt-4 h-11 w-full text-sm font-medium text-ink-sub"
            >
              닫기
            </button>
          </>
        )}
      </Modal>

      {drawing && <ChallengeDrawOverlay emoji={drawing.emoji} name={drawing.name} />}
    </>
  );
}
