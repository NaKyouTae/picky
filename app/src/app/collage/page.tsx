import { redirect } from 'next/navigation';
import { CollageMaker } from '@/components/collage-maker';
import { getSession } from '@/lib/auth';
import { getChallengeProofs } from '@/lib/challenge-proofs';
import { getCollageTemplates } from '@/lib/collage-templates';
import { getMyMembership } from '@/lib/memberships';

export const metadata = { title: '콜라주 만들기 · Picky' };

// 공개된 템플릿이 바로 반영돼야 해서 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 챌린지를 끝까지 완료하면 오는 화면.
 *
 * 완료한 그룹의 id 가 쿼리로 오면 그 그룹의 인증 사진을 미리 채워 준다
 * (챌린지 화면이 `/collage?group=…` 로 보낸다). 직접 들어온 경우엔 비어 있고, 기기에서 골라 넣는다.
 */
export default async function CollagePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const [session, templates, membership, { group }] = await Promise.all([
    getSession(),
    getCollageTemplates(),
    getMyMembership(),
    searchParams,
  ]);
  if (!session) redirect('/');

  const proofs = group ? await getChallengeProofs(group) : [];

  // 결제를 마치면 이 화면으로 되돌아와야 인증 사진이 그대로 다시 채워진다
  // (사진은 브라우저 메모리에만 있어서 화면을 떠나면 사라진다).
  const returnTo = group ? `/collage?group=${encodeURIComponent(group)}` : '/collage';

  // 뒤로 가면 방금 끝낸 그룹의 마지막(5번째) 챌린지 화면으로 돌아간다.
  // 브라우저 히스토리를 따라가면 챌린지 화면을 replace 로 덮고 왔기 때문에 홈으로 빠진다.
  const backHref = group ? `/challenge?group=${encodeURIComponent(group)}` : null;

  // 회원권이 살아 있으면 유료 템플릿의 잠금을 푼다.
  return (
    <CollageMaker
      templates={templates}
      proofs={proofs}
      hasMembership={membership.active}
      membershipHref={`/membership?returnTo=${encodeURIComponent(returnTo)}`}
      backHref={backHref}
    />
  );
}
