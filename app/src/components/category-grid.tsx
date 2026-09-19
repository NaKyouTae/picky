'use client';

import { CATEGORY_META, type ChallengeCategory } from '@/lib/challenges';
import { cn } from '@/lib/utils';

/**
 * 카테고리 3개를 고르는 그리드.
 * 메인의 카테고리 선택 모달과 챌린지 화면(카테고리 없이 직접 들어온 경우)에서 함께 쓴다.
 * 공개된 챌린지가 없는 카테고리는 '준비 중' 으로 비활성화한다.
 */
export function CategoryGrid({
  counts,
  selected,
  onSelect,
}: {
  counts: Map<ChallengeCategory, number>;
  selected?: ChallengeCategory | null;
  onSelect: (category: ChallengeCategory) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {CATEGORY_META.map((meta) => {
        const count = counts.get(meta.category) ?? 0;
        const active = selected === meta.category;
        return (
          <li key={meta.category}>
            <button
              type="button"
              onClick={() => onSelect(meta.category)}
              disabled={count === 0}
              aria-pressed={active}
              className={cn(
                'flex min-h-11 w-full flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-colors',
                active ? 'border-brand-500 bg-brand-50' : 'border-line bg-white active:bg-gray-50',
                count === 0 && 'opacity-40',
              )}
            >
              <span className="text-2xl leading-none">{meta.emoji}</span>
              <span className="text-sm font-semibold">{meta.label}</span>
              <span className="text-[11px] text-ink-sub">
                {count === 0 ? '준비 중' : `${count}개`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
