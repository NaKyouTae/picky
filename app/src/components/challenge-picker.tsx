'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CategoryGrid } from '@/components/category-grid';
import {
  CATEGORY_LABELS,
  type Challenge,
  type ChallengeCategory,
  type ChallengeCategorySummary,
} from '@/lib/challenges';

/** 한 번의 뽑기 요청 — nonce 로 '다시 뽑기' 를 같은 조건에서도 새 요청으로 구분한다 */
type DrawRequest = {
  category: ChallengeCategory;
  /** 방금 뽑힌 챌린지를 제외해 같은 게 연달아 나오지 않게 한다 */
  excludeId?: string;
  nonce: number;
};

type DrawResult = {
  nonce: number;
  challenge: Challenge | null;
  message: string | null;
};

/**
 * 챌린지 결과 화면.
 * 카테고리는 메인의 선택 모달에서 쿼리로 넘어오며, 들어오는 즉시 한 번 뽑는다.
 * 카테고리 없이 직접 들어온 경우에만 카테고리 그리드를 보여준다.
 * 뽑기 대상은 서버가 공개 상태만 골라 결정하므로 클라이언트는 결과만 그린다.
 */
export function ChallengePicker({
  summary,
  initialCategory,
}: {
  summary: ChallengeCategorySummary[];
  initialCategory: ChallengeCategory | null;
}) {
  const counts = new Map(summary.map((row) => [row.category, row.count]));
  const [request, setRequest] = useState<DrawRequest | null>(
    initialCategory ? { category: initialCategory, nonce: 0 } : null,
  );
  const [result, setResult] = useState<DrawResult | null>(null);

  // 요청의 nonce 와 도착한 결과의 nonce 가 다르면 아직 뽑는 중이다.
  // loading 을 state 로 두면 effect 안에서 동기 setState 를 해야 해서 파생값으로 계산한다.
  const loading = request !== null && result?.nonce !== request.nonce;

  useEffect(() => {
    if (!request) return;

    const controller = new AbortController();
    const { category, excludeId, nonce } = request;

    void (async () => {
      const params = new URLSearchParams({ category });
      if (excludeId) params.set('excludeId', excludeId);

      try {
        const res = await fetch(`/api/challenges/random?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 404) {
          setResult({ nonce, challenge: null, message: '이 카테고리는 아직 준비 중이에요.' });
          return;
        }
        if (!res.ok) throw new Error();
        setResult({ nonce, challenge: (await res.json()) as Challenge, message: null });
      } catch {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setResult({
          nonce,
          challenge: null,
          message: '챌린지를 불러오지 못했어요. 다시 시도해 주세요.',
        });
      }
    })();

    return () => controller.abort();
  }, [request]);

  const challenge = loading ? null : (result?.challenge ?? null);
  const message = loading ? null : (result?.message ?? null);

  function handleSelect(category: ChallengeCategory) {
    setRequest({ category, nonce: (request?.nonce ?? -1) + 1 });
  }

  function handleRedraw() {
    if (!request) return;
    setRequest({
      category: request.category,
      excludeId: challenge?.id,
      nonce: request.nonce + 1,
    });
  }

  return (
    <div className="pb-cta flex flex-1 flex-col px-5 pt-6">
      <header className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">챌린지</h1>
          <p className="mt-1 text-sm text-ink-sub">
            {request
              ? `${CATEGORY_LABELS[request.category]} 챌린지예요.`
              : '누구와 함께할지 고르면, 오늘 할 일을 하나 뽑아 드려요.'}
          </p>
        </div>

        {/* 하단 네비가 없으므로 홈으로 돌아가는 유일한 출구 */}
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

      {/* 챌린지는 디바이스 세로 기준 가운데에 온다 (헤더와 하단 CTA 사이의 남은 공간 중앙) */}
      {!request && (
        <div className="flex flex-1 flex-col justify-center py-6">
          <CategoryGrid counts={counts} onSelect={handleSelect} />
          <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-sub">
            카테고리를 고르면
            <br />
            챌린지가 랜덤으로 뽑혀요.
          </p>
        </div>
      )}

      {request && (
        <div className="flex flex-1 flex-col justify-center py-6">
          {loading && (
            <div className="rounded-2xl border border-line px-5 py-14 text-center">
              <p className="text-sm text-ink-sub">뽑는 중…</p>
            </div>
          )}

          {message && (
            <div className="rounded-2xl border border-line px-5 py-14 text-center">
              <p className="text-sm text-ink-sub">{message}</p>
            </div>
          )}

          {challenge && (
            <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <p className="text-3xl leading-none">{challenge.emoji ?? '🎯'}</p>
              <h2 className="mt-3 text-xl font-bold leading-snug">{challenge.title}</h2>
              {challenge.duration && (
                <p className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                  {challenge.duration}
                </p>
              )}
              {challenge.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-sub">
                  {challenge.description}
                </p>
              )}
            </article>
          )}
        </div>
      )}

      {/* 하단 고정 CTA — 앱 셸이 fixed 의 컨테이닝 블록이라 셸 하단에 붙는다.
          콘텐츠가 가려지지 않도록 위 컨테이너에 pb-cta 를 준다. */}
      {request && (
        <div className="pb-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-5 pt-3 backdrop-blur">
          <button
            type="button"
            onClick={handleRedraw}
            disabled={loading}
            className="h-14 w-full rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600 disabled:opacity-60"
          >
            {loading ? '뽑는 중…' : '다시 뽑기'}
          </button>
        </div>
      )}
    </div>
  );
}
