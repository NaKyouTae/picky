-- 고객 문의 — 앱 마이페이지 → 문의하기로 들어오고 어드민에서 읽는다.
--
-- 답변은 이 표를 거치지 않는다: 관리자가 inquiries.email 로 직접 메일을 보내고
-- 무엇을 회신했는지만 admin_note 에 남긴다 (앱에는 문의 내역 화면이 없다).
-- 첨부 사진은 private 버킷 `inquiries` 에 올라가고 경로만 inquiry_images 에 남는다.

-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('USAGE', 'PAYMENT', 'CHALLENGE', 'COLLAGE', 'ERROR', 'ETC');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'ANSWERED');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "InquiryType" NOT NULL,
    "content" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'RECEIVED',
    "admin_note" TEXT,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_images" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "image_path" VARCHAR(500) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_images_pkey" PRIMARY KEY ("id")
);

-- 어드민 목록: WHERE status? ORDER BY created_at desc
-- CreateIndex
CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries"("status", "created_at");

-- 어드민 목록의 유형 필터: WHERE type ORDER BY created_at desc
-- CreateIndex
CREATE INDEX "inquiries_type_created_at_idx" ON "inquiries"("type", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_created_at_idx" ON "inquiries"("created_at");

-- 한 사용자가 보낸 문의 모아 보기
-- CreateIndex
CREATE INDEX "inquiries_user_id_created_at_idx" ON "inquiries"("user_id", "created_at");

-- 문의별 사진을 순서대로 읽는 조회까지 함께 커버한다
-- CreateIndex
CREATE UNIQUE INDEX "inquiry_images_inquiry_id_display_order_key" ON "inquiry_images"("inquiry_id", "display_order");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_images" ADD CONSTRAINT "inquiry_images_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
