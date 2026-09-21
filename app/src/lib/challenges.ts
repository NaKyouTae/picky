/** 서버(NestJS)의 challenges / challenge-groups 응답 타입 — 서버/클라이언트 공용 */

/** 어드민에서 등록하는 챌린지 카테고리 (앱 메인에 나열된다) */
export type ChallengeCategory = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  /** 공개 챌린지 수 — 0 이면 "준비 중" 으로 표시한다 */
  challengeCount: number;
};

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  emoji: string | null;
};

/** 그룹에 담긴 챌린지 한 칸 */
export type ChallengeGroupItem = {
  id: string;
  /** 그룹 안에서 몇 번째로 나왔는지 (1..5) */
  position: number;
  createdAt: string;
  challenge: Challenge;
};

/** 상태·일자는 그룹 단위로만 관리한다 */
export type ChallengeGroupStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ENDED';

export type ChallengeGroup = {
  id: string;
  status: ChallengeGroupStatus;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  startedAt: string;
  endedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; emoji: string | null; description: string | null };
  /** position 오름차순 */
  items: ChallengeGroupItem[];
};

/** 한 그룹에 담을 수 있는 챌린지 수 — 서버와 맞춘다 */
export const MAX_CHALLENGES_PER_GROUP = 5;
