'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChallengeDrawOverlay, startMinimumDraw } from '@/components/challenge-draw-overlay';
import { MAX_CHALLENGES_PER_GROUP, type ChallengeGroup } from '@/lib/challenges';

type Pending = 'DRAW' | 'COMPLETED' | 'ENDED' | null;

/**
 * 진행 중인 챌린지 그룹 화면.
 *
 * 그룹에는 챌린지가 하나씩 최대 5개까지 담긴다. 가장 최근에 담긴 것이 지금 할 챌린지이고,
 * '다시 뽑기' 는 그룹에 없는 챌린지 중에서 하나를 더 담는다 (담긴 건 다시 나오지 않는다).
 * 상태·일자는 그룹 단위로만 기록되므로 완료/그만두기는 그룹 전체에 적용된다.
 */
export function ChallengeGroupScreen({ group }: { group: ChallengeGroup }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const current = group.items.at(-1);
  const drawn = group.items.length;
  const full = drawn >= MAX_CHALLENGES_PER_GROUP;

  async function call(action: Exclude<Pending, null>) {
    setPending(action);
    setError(null);

    const isDraw = action === 'DRAW';
    // 다시 뽑기도 카테고리 선택과 같은 두구두구 화면을 쓴다.
    const minimumDraw = isDraw ? startMinimumDraw() : null;
    const url = isDraw
      ? `/api/challenge-groups/${group.id}/draw`
      : `/api/challenge-groups/${group.id}`;

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: isDraw ? undefined : JSON.stringify({ status: action }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();

      if (isDraw) {
        // 서버가 그룹에 챌린지를 하나 더 담았다. 새로 받아오는 동안 두구두구를 유지해
        // 이전 챌린지가 잠깐 다시 보이는 일이 없게 한다.
        router.refresh();
        if (minimumDraw) await minimumDraw;
        setPending(null);
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError(
        isDraw
          ? '다시 뽑지 못했어요. 잠시 후 시도해 주세요.'
          : '처리하지 못했어요. 다시 시도해 주세요.',
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
            챌린지 {drawn} / {MAX_CHALLENGES_PER_GROUP}개 진행 중
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

        {/* 앞서 나온 챌린지들 — 그룹에 무엇이 담겼는지 한눈에 보이게 */}
        {drawn > 1 && (
          <ol className="mt-4 space-y-1.5">
            {group.items.slice(0, -1).map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-ink-sub">
                <span className="w-4 shrink-0 text-center text-xs">{item.position}</span>
                <span className="truncate">
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
          onClick={() => void call('DRAW')}
          disabled={pending !== null || full}
          className="h-14 w-full rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600 disabled:opacity-60"
        >
          {full ? '5개를 모두 뽑았어요' : '다시 뽑기'}
        </button>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void call('ENDED')}
            disabled={pending !== null}
            className="h-12 flex-1 rounded-2xl border border-line bg-white text-sm font-semibold text-ink-sub active:bg-gray-50 disabled:opacity-60"
          >
            {pending === 'ENDED' ? '처리 중…' : '그만두기'}
          </button>
          <button
            type="button"
            onClick={() => void call('COMPLETED')}
            disabled={pending !== null}
            className="h-12 flex-1 rounded-2xl border border-line bg-white text-sm font-semibold text-ink active:bg-gray-50 disabled:opacity-60"
          >
            {pending === 'COMPLETED' ? '처리 중…' : '완료하기'}
          </button>
        </div>
      </div>

      {pending === 'DRAW' && (
        <ChallengeDrawOverlay emoji={group.category.emoji} name={group.category.name} />
      )}
    </div>
  );
}
