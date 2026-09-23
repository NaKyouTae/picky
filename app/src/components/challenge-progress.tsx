import { MAX_CHALLENGES_PER_GROUP } from '@/lib/challenges';
import { cn } from '@/lib/utils';

/**
 * 그룹 진행바 — 칸 수만큼 균등하게 나눈 막대 (디자인 4598:5671).
 * 완료한 칸은 흰색, 남은 칸은 같은 흰색의 20% 다.
 *
 * 진행 상황은 카드 제목·배지로 이미 글로 드러나므로 보조 표시로만 둔다(aria-hidden).
 */
export function ChallengeProgress({
  done,
  total = MAX_CHALLENGES_PER_GROUP,
  className,
}: {
  /** 완료한 칸 수 */
  done: number;
  total?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2', className)} aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-1 flex-1 rounded-full',
            index < done ? 'bg-night-text' : 'bg-night-text/20',
          )}
        />
      ))}
    </div>
  );
}
