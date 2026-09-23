'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChallengeDrawOverlay, startMinimumDraw } from '@/components/challenge-draw-overlay';
import {
  BADGE_BY_SHAPE,
  CategoryShape,
  PRESSED_BY_SHAPE,
  SELECTED_BY_SHAPE,
  resolveShapeKey,
} from '@/components/category-shape';
import { ChallengeProgress } from '@/components/challenge-progress';
import { Modal, type DialogState } from '@/components/modal';
import type { ChallengeCategory, ChallengeGroup } from '@/lib/challenges';
import { cn } from '@/lib/utils';

/**
 * 메인 화면의 카테고리 목록.
 *
 * 카테고리를 고르는 것이 곧 챌린지 그룹 생성이다 — 별도 시작 버튼이 없다.
 * 진행 중인 그룹은 **카테고리마다** 하나씩 가질 수 있어서, 이미 진행 중인 카테고리를 누르면
 * 새로 시작하지 않고 그 챌린지를 이어서 연다.
 * 세션 판정은 서버 컴포넌트가 하고(쿠키 유효성까지 NestJS 가 확인) 여기서는 결과만 받는다.
 */
export function CategoryList({
  categories,
  loggedIn,
  activeGroups,
}: {
  categories: ChallengeCategory[];
  loggedIn: boolean;
  /** 진행 중인 그룹 전부 — 카테고리당 최대 하나 */
  activeGroups: ChallengeGroup[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>('closed');
  /** 어떤 카테고리를 누르다 막혔는지 — 모달에서 '새로 시작' 을 고르면 이걸로 재시도한다 */
  const [picked, setPicked] = useState<ChallengeCategory | null>(null);
  /** 뽑는 중인 카테고리 — 값이 있으면 전체 화면 두구두구 로딩을 덮는다 */
  const [drawing, setDrawing] = useState<ChallengeCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 색이 칠해진 카드 — 뽑는 중이거나, 그 카테고리 때문에 모달이 떠 있는 동안 선택 상태를 유지한다.
   * 모달이 닫히면 picked 는 남아 있어도(모달의 '새로 시작' 재시도용) 선택 표시는 풀린다.
   */
  const selectedId = drawing?.id ?? (dialog !== 'closed' ? picked?.id : undefined);

  /** 카테고리 id → 그 카테고리의 진행 중 그룹 (카드마다 매번 훑지 않도록 한 번만 만든다) */
  const activeByCategory = new Map(activeGroups.map((group) => [group.category.id, group]));

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

      // 쿠키가 만료된 뒤 눌렀을 수 있다 — 로그인 화면으로 보낸다.
      if (res.status === 401) {
        setDrawing(null);
        router.push('/login');
        return;
      }
      // 같은 카테고리를 다른 탭에서 먼저 시작한 경우 — 이어서 할지 새로 할지 묻는다.
      if (res.status === 409) {
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
      // 진행 중 그룹이 여럿일 수 있으므로 어느 카테고리를 볼지 붙여서 넘긴다.
      setDialog('closed');
      router.push(`/challenge?category=${category.id}`);
      router.refresh();
    } catch {
      setDrawing(null);
      setError('시작하지 못했어요. 다시 시도해 주세요.');
    }
  }

  function handleClick(category: ChallengeCategory) {
    // 로그인 진입점은 /login 하나다 — 여기서 묻지 않고 그 화면으로 보낸다.
    if (!loggedIn) {
      router.push('/login');
      return;
    }
    // 이 카테고리가 이미 진행 중이면 이어서 할지 새로 뽑을지 묻는다 (디자인 4636:3854).
    // 새로 시작하면 지금까지의 진행이 버려지므로 말없이 둘 중 하나를 고르지 않는다.
    if (activeByCategory.has(category.id)) {
      setPicked(category);
      setDialog('open');
      return;
    }
    void start(category, false);
  }

  return (
    <>
      {categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-6 py-12 text-center text-sm text-night-sub">
          아직 준비된 카테고리가 없어요.
        </p>
      ) : (
        // 디자인에서 카드는 남은 높이를 균등하게 나눠 가진다 (3개 기준 각 190.67px).
        // 카테고리가 더 늘면 min-height 를 유지한 채 스크롤된다.
        <ul className="flex flex-1 flex-col gap-3">
          {categories.map((category, index) => {
            const empty = category.challengeCount === 0;
            const shape = resolveShapeKey(category.name, index);
            const selected = category.id === selectedId;
            const active = activeByCategory.get(category.id);
            const done = active?.items.filter((item) => item.completedAt !== null).length ?? 0;
            return (
              <li key={category.id} className="flex min-h-[190.67px] flex-1">
                <button
                  type="button"
                  onClick={() => handleClick(category)}
                  disabled={empty || drawing !== null}
                  aria-pressed={selected}
                  className={cn(
                    // 테두리는 선택 여부와 관계없이 항상 자리를 차지한다 —
                    // 선택될 때 생기면 1px 만큼 카드와 도형이 흔들린다.
                    'relative flex w-full flex-col overflow-hidden rounded-lg border p-6 text-left leading-none',
                    selected
                      ? SELECTED_BY_SHAPE[shape]
                      : cn('border-transparent bg-night-card', !empty && PRESSED_BY_SHAPE[shape]),
                    empty && 'opacity-40',
                  )}
                >
                  <span className="text-[16px] font-medium">{category.name}</span>
                  {category.description && (
                    <span className="mt-2.5 line-clamp-2 text-[14px] leading-snug">
                      {category.description}
                    </span>
                  )}
                  {/* 진행 중이면 카테고리 색 배지를 단다 (디자인 4598:5671) */}
                  {active && (
                    <span
                      className={cn(
                        'mt-2.5 self-start p-1 text-[12px] leading-none',
                        BADGE_BY_SHAPE[shape],
                      )}
                    >
                      진행중
                    </span>
                  )}

                  {/* 챌린지가 없는 카테고리는 눌러도 시작할 수 없으니 이유를 표시한다 */}
                  {empty && <span className="mt-2 text-[12px] text-night-sub">준비 중</span>}

                  {/* 카드 아래를 채우는 도형 — 바닥에 붙여 두고 카드가 잘라 낸다 */}
                  <CategoryShape
                    name={category.name}
                    index={index}
                    className="pointer-events-none absolute bottom-0 right-6 h-auto w-[58%]"
                  />

                  {/* 진행바는 도형 위에 얹힌다 — 도형보다 뒤에 둬야 가려지지 않는다 */}
                  {active && (
                    <ChallengeProgress done={done} className="absolute inset-x-6 bottom-6" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-3 text-center text-sm text-[#ff8a85]">{error}</p>}

      {/* 진행 중인 챌린지가 있을 때 (디자인 4636:3854).
          같은 카테고리를 다른 탭에서 먼저 시작해 서버가 409 를 준 경우에도 같은 팝업이 뜬다. */}
      <Modal
        state={dialog}
        onRequestClose={() => setDialog('closing')}
        onClosed={() => setDialog('closed')}
        labelledBy="category-dialog-title"
        panelClassName="bg-night-card p-5 font-mono text-night-text"
        overlayClassName="bg-black/60"
        containerClassName="px-5"
      >
        {/* 디자인은 제목 없이 안내 문장 하나다 — 그 문장이 그대로 대화상자의 이름이 된다 */}
        <p
          id="category-dialog-title"
          className="py-2 text-center text-[16px] leading-[1.6] [word-break:keep-all]"
        >
          아직 진행 중인 챌린지가 있어요.
          <br />
          이어서 즐길까요, 새롭게 시작할까요?
        </p>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => picked && void start(picked, true)}
            disabled={drawing !== null || !picked}
            className="h-13 flex-1 rounded-lg bg-night-raised text-[16px] font-medium text-night-text active:bg-night-raised/80 disabled:opacity-60"
          >
            새로하기
          </button>
          <Link
            href={picked ? `/challenge?category=${picked.id}` : '/challenge'}
            className="flex h-13 flex-1 items-center justify-center rounded-lg bg-point text-[16px] font-medium text-night active:bg-point/80"
          >
            계속하기
          </Link>
        </div>

        {/* 새로하기가 실패하면 팝업이 열린 채로 남는다 — 이유를 여기서 보여준다 */}
        {error && <p className="mt-4 text-center text-sm text-[#ff8a85]">{error}</p>}
      </Modal>

      {drawing && <ChallengeDrawOverlay />}
    </>
  );
}
