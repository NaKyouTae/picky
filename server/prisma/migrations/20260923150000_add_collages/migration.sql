-- 완성한 콜라주 보관 — 회원권이 살아 있을 때 내려받으면 Storage(private 버킷 `collages`)에 남는다.
--
-- 무료 사용자는 기기에 내려받기만 하고 여기에 행이 생기지 않는다.
-- 그룹당 한 장이라 다시 내려받으면 마지막 것으로 갈아 끼운다 (아래 unique 제약).
-- 기간이 끝나면 파일은 그대로 두고 내려받기만 막으므로, 다시 구매하면 예전 콜라주를 받을 수 있다.

-- CreateTable
CREATE TABLE "collages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "image_path" VARCHAR(500) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collages_pkey" PRIMARY KEY ("id")
);

-- 그룹당 한 장 — 그룹으로 찾는 단건 조회도 이 제약이 커버한다.
-- CreateIndex
CREATE UNIQUE INDEX "collages_group_id_key" ON "collages"("group_id");

-- 내 보관함 목록: WHERE user_id ORDER BY created_at desc
-- CreateIndex
CREATE INDEX "collages_user_id_created_at_idx" ON "collages"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "collages" ADD CONSTRAINT "collages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collages" ADD CONSTRAINT "collages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "challenge_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
