-- CreateEnum
CREATE TYPE "ChallengeAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ENDED');

-- CreateTable
CREATE TABLE "challenge_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "status" "ChallengeAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challenge_attempts_user_id_status_idx" ON "challenge_attempts"("user_id", "status");

-- CreateIndex
CREATE INDEX "challenge_attempts_user_id_created_at_idx" ON "challenge_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "challenge_attempts_challenge_id_idx" ON "challenge_attempts"("challenge_id");

-- AddForeignKey
ALTER TABLE "challenge_attempts" ADD CONSTRAINT "challenge_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_attempts" ADD CONSTRAINT "challenge_attempts_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
