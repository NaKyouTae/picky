-- CreateEnum
CREATE TYPE "ChallengeCategory" AS ENUM ('SOLO', 'COUPLE', 'KIDS');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "category" "ChallengeCategory" NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "duration" VARCHAR(40),
    "emoji" VARCHAR(8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challenges_category_status_idx" ON "challenges"("category", "status");

-- CreateIndex
CREATE INDEX "challenges_status_created_at_idx" ON "challenges"("status", "created_at");

-- CreateIndex
CREATE INDEX "challenges_created_at_idx" ON "challenges"("created_at");
