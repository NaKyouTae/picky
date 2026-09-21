'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChallengeDrawOverlay, startMinimumDraw } from '@/components/challenge-draw-overlay';
import { MAX_CHALLENGES_PER_GROUP, type ChallengeGroup } from '@/lib/challenges';

type Pending = 'REDRAW' | 'COMPLETE' | 'END' | null;

/** 뽑기가 일어나는 동작 — 두구두구 화면을 덮는다 */
const DRAWS: Pending[] = ['REDRAW', 'COMPLETE'];

/**
 * 진행 중인 챌린지 그룹 화면.
 *
 * - **다시 뽑기**: 현재 칸의 챌린지만 교체한다 (칸 번호는 그대로).
 * - **완료하기**: 현재 챌린지를 완료하고 다음 칸을 새로 뽑는다. 5번째를 완료하면 그룹이 끝난다.
 * - **그만두기**: 완료하지 않고 그룹을 닫는다.
 */
export function ChallengeGroupScreen({ group: initialGroup }: { group: ChallengeGroup }) {
  const router = useRouter();
  /**
   * 화면에 그리는 그룹.
   * 다시 뽑기·완료하기 응답에 갱신된 그룹이 그대로 들어 있어 그것으로 바로 바꾼다.
   * `router.refresh()` 의 서버 재렌더를 기다리면 그 사이 이전 챌린지가 보이기 때문이다.
   */
  const [group, setGroup] = useState(initialGroup);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  // 아직 완료하지 않은 칸이 지금 할 챌린지다.
  const current = group.items.find((item) => item.completedAt === null);
  const completed = group.items.filter((item) => item.completedAt !== null);

  async function call(action: Exclude<Pending, null>) {
    setPending(action);
    setError(null);

    // 다시 뽑기와 완료하기는 둘 다 새 챌린지를 뽑으므로 같은 두구두구 화면을 쓴다.
    const minimumDraw = DRAWS.includes(action) ? startMinimumDraw() : null;
    const path = { REDRAW: 'redraw', COMPLETE: 'complete', END: 'end' }[action];

    try {
      const res = await fetch(`/api/challenge-groups/${group.id}/${path}`, {
        method: 'PATCH',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();

      const next = (await res.json()) as ChallengeGroup;

      // 그룹이 끝났으면(5번째 완료 / 그만두기) 홈으로 돌아간다.
      if (next.status !== 'IN_PROGRESS') {
        if (minimumDraw) await minimumDraw;
        router.replace('/');
        router.refresh();
        return;
      }

      // 두구두구가 덮고 있는 동안 새 내용으로 먼저 바꿔 두고, 그다음 오버레이를 걷는다.
      // 그래서 오버레이가 사라지는 순간 이미 새 챌린지가 그려져 있다.
      setGroup(next);
      if (minimumDraw) await minimumDraw;
      setPending(null);
    } catch {
      setError(
        action === 'END'
          ? '처리하지 못했어요. 다시 시도해 주세요.'
          : '다시 뽑지 못했어요. 잠시 후 시도해 주세요.',
      );
      setPending(null);
    }
  }

  return (
    <div className="pb-cta flex flex-1 flex-col px-5 pt-6">
      <header className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            {group.category.emoji} {group.category.name}
          </h1>
          <p className="mt-1 text-sm text-ink-sub">
            {current
              ? `${current.position} / ${MAX_CHALLENGES_PER_GROUP}번째 챌린지`
              : `${completed.length}개 완료`}
          </p>
        </div>

        <Link
          href="/"
          aria-label="닫기"
          className="-mr-2 ml-auto flex size-11 shrink-0 items-center justify-center text-ink-sub active:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            className="size-6"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </header>

      {/* 지금 할 챌린지는 디바이스 세로 기준 가운데에 온다 */}
      <div className="flex flex-1 flex-col justify-center py-6">
        {current && (
          <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <p className="text-3xl leading-none">{current.challenge.emoji ?? '🎯'}</p>
              <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-ink-sub">
                {current.position}번째
              </span>
            </div>
            <h2 className="mt-3 text-xl font-bold leading-snug">{current.challenge.title}</h2>
            {current.challenge.duration && (
              <p className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {current.challenge.duration}
              </p>
            )}
            {current.challenge.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-sub">
                {current.challenge.description}
              </p>
            )}
          </article>
        )}

        {/* 완료한 챌린지만 아래에 쌓인다 (다시 뽑기로 교체된 것은 남지 않는다) */}
        {completed.length > 0 && (
          <ol className="mt-4 space-y-1.5">
            {completed.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-ink-sub">
                <span className="shrink-0 text-brand-500" aria-hidden>
                  ✓
                </span>
                <span className="truncate line-through">
                  {item.challenge.emoji} {item.challenge.title}
                </span>
              </li>
            ))}
          </ol>
        )}

        {error && <p className="mt-3 text-center text-sm text-brand-600">{error}</p>}
      </div>

      <div className="pb-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-5 pt-3 backdrop-blur">
        <button
          type="button"
          onClick={() => void call('REDRAW')}
          disabled={pending !== null || !current}
          className="h-14 w-full rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600 disabled:opacity-60"
        >
          다시 뽑기
        </button>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void call('END')}
            disabled={pending !== null}
            className="h-12 flex-1 rounded-2xl border border-line bg-white text-sm font-semibold text-ink-sub active:bg-gray-50 disabled:opacity-60"
          >
            {pending === 'END' ? '처리 중…' : '그만두기'}
          </button>
          <button
            type="button"
            onClick={() => void call('COMPLETE')}
            disabled={pending !== null || !current}
            className="h-12 flex-1 rounded-2xl border border-line bg-white text-sm font-semibold text-ink active:bg-gray-50 disabled:opacity-60"
          >
            완료하기
          </button>
        </div>
      </div>

      {pending !== null && DRAWS.includes(pending) && (
        <ChallengeDrawOverlay emoji={group.category.emoji} name={group.category.name} />
      )}
    </div>
  );
}
