-- 사진 자리는 앱에서 사용자가 직접 정하므로 서버가 보관하지 않는다.
-- AlterTable
ALTER TABLE "sticker_templates" DROP COLUMN "slots";
