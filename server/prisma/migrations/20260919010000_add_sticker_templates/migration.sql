-- CreateEnum
CREATE TYPE "StickerTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "sticker_templates" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "StickerTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "image_url" TEXT NOT NULL,
    "image_path" VARCHAR(500) NOT NULL,
    "image_width" INTEGER NOT NULL,
    "image_height" INTEGER NOT NULL,
    "slots" JSONB NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sticker_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sticker_templates_status_display_order_created_at_idx" ON "sticker_templates"("status", "display_order", "created_at");

-- CreateIndex
CREATE INDEX "sticker_templates_status_created_at_idx" ON "sticker_templates"("status", "created_at");

-- CreateIndex
CREATE INDEX "sticker_templates_created_at_idx" ON "sticker_templates"("created_at");
