-- 챌린지는 제목 한 줄만 갖는다 — 설명·소요 시간·이모지를 더 이상 쓰지 않아 컬럼째 지운다.
-- 앱/어드민 어디에서도 읽지 않던 값이라 옮겨 둘 곳 없이 그대로 버린다.
ALTER TABLE "challenges" DROP COLUMN "description";
ALTER TABLE "challenges" DROP COLUMN "duration";
ALTER TABLE "challenges" DROP COLUMN "emoji";
