-- 약관·개인정보 동의 기록.
-- users 에는 항목별 최신 동의 시각만 두고, 동의·철회 이력은 consent_logs 에 append-only 로 쌓는다.
-- 기존 회원은 동의를 받은 적이 없으므로 NULL 로 남긴다 — 마이페이지 약관 화면에서 직접 동의를 받는다.

CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING');

ALTER TABLE "users"
  ADD COLUMN "terms_agreed_at" TIMESTAMP(3),
  ADD COLUMN "privacy_agreed_at" TIMESTAMP(3),
  ADD COLUMN "marketing_agreed_at" TIMESTAMP(3),
  ADD COLUMN "marketing_expires_at" TIMESTAMP(3);

CREATE TABLE "consent_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consent_logs_user_id_type_created_at_idx" ON "consent_logs"("user_id", "type", "created_at");

ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
