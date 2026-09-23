import { api } from '@/lib/api';

/** 챌린지 칸별 인증 사진 — position 오름차순, 사진을 올린 칸만 들어 있다 */
export type ChallengeProof = { position: number; url: string };

/**
 * 콜라주에 넣을 인증 사진 주소.
 *
 * private 버킷이라 짧게 만료되는 signed URL 이 온다 — 페이지를 열 때마다 새로 받아야 한다.
 * 서버가 그룹 소유자를 확인하므로 남의 그룹 id 로는 받아지지 않는다.
 */
export async function getChallengeProofs(groupId: string): Promise<ChallengeProof[]> {
  return api
    .get<ChallengeProof[]>(`/challenge-groups/${groupId}/proofs`, { cache: 'no-store' })
    .catch(() => [] as ChallengeProof[]);
}
