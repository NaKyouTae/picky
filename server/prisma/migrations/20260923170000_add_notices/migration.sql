-- 공지사항 — 어드민에서 등록하고 앱 마이페이지에서 읽는다.
--
-- published_at 을 created_at 과 따로 두는 이유: 작성(DRAFT)과 공개 시점이 다르고,
-- 미래 시각을 넣어 예약 게시할 수 있다 (앱 목록은 published_at <= now() 만 내려준다).

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- 앱 목록: WHERE status AND published_at <= now() ORDER BY is_pinned desc, published_at desc
-- CreateIndex
CREATE INDEX "notices_status_is_pinned_published_at_idx" ON "notices"("status", "is_pinned", "published_at");

-- 어드민 목록: WHERE status? ORDER BY created_at desc
-- CreateIndex
CREATE INDEX "notices_status_created_at_idx" ON "notices"("status", "created_at");

-- CreateIndex
CREATE INDEX "notices_created_at_idx" ON "notices"("created_at");
