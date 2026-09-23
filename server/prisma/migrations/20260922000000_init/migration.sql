-- Picky 초기 스키마.
--
-- 이전의 마이그레이션 22 개를 하나로 합친 것이다. 운영 전이라 이력을 보존할 이유가 없어
-- 현재 schema.prisma 에서 통째로 다시 만들었다 (중간에 추가됐다 삭제된 컬럼·테이블은 처음부터 없다).
--
-- 챌린지 카테고리·챌린지 같은 기본 데이터는 여기 넣지 않는다 — 마이그레이션은 스키마만 다룬다.
-- 마이그레이션 후 `pnpm --filter @picky/server db:seed` 로 함께 넣는다.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('KAKAO', 'NAVER');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('SELF', 'KAKAO', 'NAVER');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChallengeGroupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ENDED');

-- CreateEnum
CREATE TYPE "StickerTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(20),
    "gender" "Gender",
    "age_range" VARCHAR(20),
    "birthday" DATE,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "terms_agreed_at" TIMESTAMP(3),
    "privacy_agreed_at" TIMESTAMP(3),
    "marketing_agreed_at" TIMESTAMP(3),
    "marketing_expires_at" TIMESTAMP(3),
    "third_party_agreed_at" TIMESTAMP(3),
    "terms_consent_source" "ConsentSource",
    "privacy_consent_source" "ConsentSource",
    "marketing_consent_source" "ConsentSource",
    "third_party_consent_source" "ConsentSource",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_type" "ProviderType" NOT NULL,
    "provider_id" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "source" "ConsentSource" NOT NULL DEFAULT 'SELF',
    "provider_tag" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "duration" VARCHAR(40),
    "emoji" VARCHAR(8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "challenge_group_items" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "proof_image_path" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sticker_templates" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "StickerTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "image_url" TEXT NOT NULL,
    "image_path" VARCHAR(500) NOT NULL,
    "preview_image_url" TEXT,
    "preview_image_path" VARCHAR(500),
    "image_width" INTEGER NOT NULL,
    "image_height" INTEGER NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "slot_count" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sticker_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "months" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "description" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_orders" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID,
    "plan_name" VARCHAR(60) NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "MembershipOrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_key" VARCHAR(200),
    "method" VARCHAR(40),
    "paid_at" TIMESTAMP(3),
    "fail_reason" VARCHAR(300),
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_type_provider_id_key" ON "accounts"("provider_type", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_provider_type_key" ON "accounts"("user_id", "provider_type");

-- CreateIndex
CREATE INDEX "consent_logs_user_id_type_created_at_idx" ON "consent_logs"("user_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "challenges_category_id_status_idx" ON "challenges"("category_id", "status");

-- CreateIndex
CREATE INDEX "challenges_status_created_at_idx" ON "challenges"("status", "created_at");

-- CreateIndex
CREATE INDEX "challenges_created_at_idx" ON "challenges"("created_at");

-- CreateIndex
CREATE INDEX "challenge_categories_status_display_order_name_idx" ON "challenge_categories"("status", "display_order", "name");

-- CreateIndex
CREATE INDEX "challenge_categories_created_at_idx" ON "challenge_categories"("created_at");

-- CreateIndex
CREATE INDEX "challenge_groups_user_id_status_idx" ON "challenge_groups"("user_id", "status");

-- CreateIndex
CREATE INDEX "challenge_groups_user_id_category_id_status_idx" ON "challenge_groups"("user_id", "category_id", "status");

-- CreateIndex
CREATE INDEX "challenge_groups_user_id_created_at_idx" ON "challenge_groups"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "challenge_groups_category_id_idx" ON "challenge_groups"("category_id");

-- CreateIndex
CREATE INDEX "challenge_group_items_challenge_id_idx" ON "challenge_group_items"("challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_group_items_group_id_challenge_id_key" ON "challenge_group_items"("group_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_group_items_group_id_position_key" ON "challenge_group_items"("group_id", "position");

-- CreateIndex
CREATE INDEX "sticker_templates_status_display_order_created_at_idx" ON "sticker_templates"("status", "display_order", "created_at");

-- CreateIndex
CREATE INDEX "sticker_templates_status_created_at_idx" ON "sticker_templates"("status", "created_at");

-- CreateIndex
CREATE INDEX "sticker_templates_created_at_idx" ON "sticker_templates"("created_at");

-- CreateIndex
CREATE INDEX "membership_plans_is_active_display_order_months_idx" ON "membership_plans"("is_active", "display_order", "months");

-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_order_code_key" ON "membership_orders"("order_code");

-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_payment_key_key" ON "membership_orders"("payment_key");

-- CreateIndex
CREATE INDEX "membership_orders_user_id_created_at_idx" ON "membership_orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "membership_orders_user_id_status_ends_at_idx" ON "membership_orders"("user_id", "status", "ends_at");

-- CreateIndex
CREATE INDEX "membership_orders_status_created_at_idx" ON "membership_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "membership_orders_created_at_idx" ON "membership_orders"("created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "challenge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_groups" ADD CONSTRAINT "challenge_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_groups" ADD CONSTRAINT "challenge_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "challenge_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_group_items" ADD CONSTRAINT "challenge_group_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "challenge_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_group_items" ADD CONSTRAINT "challenge_group_items_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_orders" ADD CONSTRAINT "membership_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

