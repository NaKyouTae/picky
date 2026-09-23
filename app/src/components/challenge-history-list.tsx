'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { ChallengeGroup, ChallengeHistoryPage } from '@/lib/challenges';

/** "2026. 09. 22." — 목록에서는 시각까지 보여 줄 이유가 없다 */
function formatDate(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}. ${month}. ${day}.`;
}

/**
 * 완료한 챌린지 내역.
 *
 * 첫 페이지는 서버 컴포넌트가 넘겨주고, '더 보기' 는 커서로 이어 받는다
 * (offset 을 쓰면 뒤 페이지로 갈수록 느려지므로).
 */
export function ChallengeHistoryList({ first }: { first: ChallengeHistoryPage }) {
  const [groups, setGroups] = useState<ChallengeGroup[]>(first.items);
  const [cursor, setCursor] = useState(first.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenge-groups/history?cursor=${cursor}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error();

      const next = (await res.json()) as ChallengeHistoryPage;
      setGroups((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch {
      setError('더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="text-base font-semibold">아직 완료한 챌린지가 없어요</p>
        <p className="mt-2 text-sm text-ink-sub">
          카테고리를 골라 챌린지를 다섯 개 끝내면 여기에 남아요.
        </p>
        <Link
          href="/"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
        >
          챌린지 시작하기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-2">
      <p className="text-sm text-ink-sub">{groups.length}개의 챌린지를 끝냈어요</p>

      <ol className="mt-4 space-y-3">
        {groups.map((group) => {
          // 다시 뽑기로 교체된 칸은 남지 않으므로, 완료한 칸이 곧 해낸 챌린지다.
          const done = group.items.filter((item) => item.completedAt !== null);

          return (
            <li key={group.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-baseline gap-2">
                <p className="text-base font-bold">
                  {group.category.emoji} {group.category.name}
                </p>
                <p className="ml-auto shrink-0 text-xs text-ink-sub">
                  {formatDate(group.completedAt ?? group.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-sub">챌린지 {done.length}개 완료</p>

              <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
                {done.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <span className="shrink-0 text-ink-sub">{item.position}</span>
                    <span className="min-w-0 flex-1">
                      {item.challenge.emoji} {item.challenge.title}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-3 text-center text-sm text-brand-600">{error}</p>}

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="mt-4 h-12 w-full rounded-2xl border border-line bg-white text-sm font-semibold text-ink-sub active:bg-canvas disabled:opacity-60"
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}
