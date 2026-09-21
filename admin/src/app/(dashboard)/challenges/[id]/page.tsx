import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChallengeForm } from '@/components/challenge-form';
import { api } from '@/lib/api';
import type { AdminChallenge, AdminChallengeCategory } from '@/lib/challenges';

export default async function EditChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 없는 id(또는 조회 실패)는 404 로 — 폼에 빈 값을 보여주지 않는다.
  const [challenge, categories] = await Promise.all([
    api.get<AdminChallenge>(`/admin/challenges/${id}`, { cache: 'no-store' }).catch(() => null),
    api
      .get<AdminChallengeCategory[]>('/admin/challenge-categories', { cache: 'no-store' })
      .catch(() => [] as AdminChallengeCategory[]),
  ]);
  if (!challenge) notFound();

  return (
    <div>
      <Link href="/challenges" className="text-sm text-ink-sub hover:underline">
        ← 챌린지 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">챌린지 수정</h1>
      <div className="mt-6">
        <ChallengeForm challenge={challenge} categories={categories} />
      </div>
    </div>
  );
}
