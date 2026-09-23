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

/**
 * 그룹의 챌린지 한 칸.
 * '다시 뽑기' 는 새 칸을 만들지 않고 현재 칸의 challenge 만 바꾼다.
 * 칸은 완료할 때만 늘어난다.
 */
export type ChallengeGroupItem = {
  id: string;
  /** 그룹 안 몇 번째 칸인지 (1..5) */
  position: number;
  /** 완료한 시각 — null 이면 지금 진행 중인 칸 */
  completedAt: string | null;
  /**
   * 인증 사진의 Storage 경로 — null 이면 아직 안 올렸다.
   * 임시 파일이라 콜라주를 만들거나 그만두면 비워진다.
   * 읽기용 URL 은 필요할 때 서버에서 signed URL 로 받는다.
   */
  proofImagePath: string | null;
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
  /**
   * 보관한 콜라주 — '콜라주 완성' 을 누르면 등급과 무관하게 생긴다.
   * 있으면 '완료한 챌린지' 에 내려받기 버튼이 붙지만, 실제로 받으려면 회원권이 살아 있어야 한다.
   */
  collage: { id: string; createdAt: string } | null;
  /** position 오름차순 */
  items: ChallengeGroupItem[];
};

/** 완료한 챌린지 내역 한 페이지 (커서 기반) */
export type ChallengeHistoryPage = {
  items: ChallengeGroup[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/**
 * 앱 메인에 고정으로 노출하는 카테고리.
 *
 * 세 개로 굳어져 있어 어드민 조회를 거치지 않는다 — 서버가 잠시 흔들려도 메인이 비지 않는다.
 * id 는 시드(`server/prisma/seeds/challenges.sql`)가 박아 두는 고정 UUID 라 환경이 달라도 같다.
 * 챌린지 뽑기는 이 id 로 서버에 요청하므로 **시드의 값과 반드시 일치해야 한다.**
 *
 * 카테고리를 늘리려면: 시드에 행을 추가하고 여기에 한 줄 더한 뒤,
 * `category-shape.tsx` 의 SHAPE_BY_NAME 에 도형을 맺어 준다.
 * (어드민의 카테고리 화면은 그때 다시 열면 된다 — 코드는 그대로 남겨 두었다.)
 */
export const FIXED_CATEGORIES: ChallengeCategory[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: '혼자서',
    emoji: null,
    description: '오롯이 나에게 집중하는 시간',
    // 실제 공개 챌린지 수는 서버가 뽑을 때 확인한다 — 여기서는 '준비 중' 으로 잠그지 않기 위한 값이다.
    challengeCount: 1,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: '함께',
    emoji: null,
    description: '같이니까, 뭐든 조금 더 재밌게',
    challengeCount: 1,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: '아기랑',
    emoji: null,
    description: '평범한 하루도 새로운 추억으로',
    challengeCount: 1,
  },
];

/** 한 그룹에 담을 수 있는 챌린지 수 — 서버와 맞춘다 */
export const MAX_CHALLENGES_PER_GROUP = 5;

/**
 * 그룹 안 한 칸의 상태.
 *
 * DB 에 따로 두지 않고 여기서 만들어 쓴다 — `completedAt` 과 칸의 존재 여부로 이미 정해지는
 * 값이라, 컬럼으로 복제하면 둘이 어긋날 수 있다(사진만 바꾸고 상태를 못 옮기는 식).
 *
 * - `LOCKED`  아직 뽑지 않은 칸. 앞 칸을 끝내야 열린다 (서버에 행이 없다)
 * - `OPEN`    열려 있고 아직 끝내지 않은 칸 = 지금 진행 중인 챌린지
 * - `DONE`    끝낸 칸. 다시 열어 사진을 바꾸거나 다시 뽑을 수 있다
 */
export type ChallengeSlotStatus = 'LOCKED' | 'OPEN' | 'DONE';

/** 칸 번호(1..5) → 상태. 서버는 열린 칸만 items 로 내려준다. */
export function slotStatus(items: ChallengeGroupItem[], position: number): ChallengeSlotStatus {
  const item = items.find((candidate) => candidate.position === position);
  if (!item) return 'LOCKED';
  return item.completedAt === null ? 'OPEN' : 'DONE';
}
