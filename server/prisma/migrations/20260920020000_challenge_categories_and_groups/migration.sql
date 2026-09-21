-- 카테고리를 enum 에서 관리자가 등록하는 테이블로 바꾸고,
-- 챌린지 참여 기록을 '챌린지 그룹(최대 5개 챌린지)' 구조로 교체한다.
--
-- 기존 challenges 30여 건의 카테고리는 이름이 같은 행으로 옮겨 보존한다.
-- challenge_attempts 는 아직 운영 데이터가 없어 그대로 버린다.

-- ── 1) 카테고리 테이블 ─────────────────────────────────
CREATE TABLE "challenge_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "emoji" VARCHAR(8),
    "description" VARCHAR(120),
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PUBLISHED',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_categories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "challenge_categories_status_display_order_name_idx" ON "challenge_categories"("status", "display_order", "name");
CREATE INDEX "challenge_categories_created_at_idx" ON "challenge_categories"("created_at");

-- 기존 enum 3종을 같은 이름·이모지로 옮겨 앱 화면이 그대로 유지되게 한다.
INSERT INTO "challenge_categories" ("id", "name", "emoji", "description", "status", "display_order", "updated_at") VALUES
  ('11111111-1111-4111-8111-111111111111', '혼자',   '🙂', '나를 위한 시간',      'PUBLISHED', 1, CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222', '둘이서', '💞', '늘 하던 데이트 말고', 'PUBLISHED', 2, CURRENT_TIMESTAMP),
  ('33333333-3333-4333-8333-333333333333', '아이랑', '🧸', '아이와 함께',        'PUBLISHED', 3, CURRENT_TIMESTAMP);

-- ── 2) challenges.category(enum) → category_id(FK) ────
ALTER TABLE "challenges" ADD COLUMN "category_id" UUID;

UPDATE "challenges" SET "category_id" = CASE "category"
    WHEN 'SOLO'   THEN '11111111-1111-4111-8111-111111111111'::uuid
    WHEN 'COUPLE' THEN '22222222-2222-4222-8222-222222222222'::uuid
    WHEN 'KIDS'   THEN '33333333-3333-4333-8333-333333333333'::uuid
  END;

-- 옮기지 못한 행이 있으면 여기서 실패해 트랜잭션이 되돌려진다 (데이터 유실 방지).
ALTER TABLE "challenges" ALTER COLUMN "category_id" SET NOT NULL;

DROP INDEX "challenges_category_status_idx";
ALTER TABLE "challenges" DROP COLUMN "category";
CREATE INDEX "challenges_category_id_status_idx" ON "challenges"("category_id", "status");

ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "challenge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3) 참여 기록 → 그룹 구조 ───────────────────────────
DROP TABLE "challenge_attempts";
DROP TYPE "ChallengeAttemptStatus";
-- 이제 이 enum 을 쓰는 컬럼이 없다
DROP TYPE "ChallengeCategory";

CREATE TYPE "ChallengeGroupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ENDED');

CREATE TABLE "challenge_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "status" "ChallengeGroupStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "challenge_groups_user_id_status_idx" ON "challenge_groups"("user_id", "status");
CREATE INDEX "challenge_groups_user_id_created_at_idx" ON "challenge_groups"("user_id", "created_at");
CREATE INDEX "challenge_groups_category_id_idx" ON "challenge_groups"("category_id");

CREATE TABLE "challenge_group_items" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_group_items_pkey" PRIMARY KEY ("id")
);

-- 같은 챌린지가 한 그룹에 두 번 들어가지 않게 (= 이미 나온 건 다시 안 뽑힘)
CREATE UNIQUE INDEX "challenge_group_items_group_id_challenge_id_key" ON "challenge_group_items"("group_id", "challenge_id");
CREATE UNIQUE INDEX "challenge_group_items_group_id_position_key" ON "challenge_group_items"("group_id", "position");
CREATE INDEX "challenge_group_items_challenge_id_idx" ON "challenge_group_items"("challenge_id");

ALTER TABLE "challenge_groups" ADD CONSTRAINT "challenge_groups_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_groups" ADD CONSTRAINT "challenge_groups_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "challenge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "challenge_group_items" ADD CONSTRAINT "challenge_group_items_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "challenge_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_group_items" ADD CONSTRAINT "challenge_group_items_challenge_id_fkey"
  FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
