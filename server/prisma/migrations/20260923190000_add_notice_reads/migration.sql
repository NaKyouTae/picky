-- 공지별 읽음 기록.
--
-- 앞 마이그레이션의 users.notices_seen_at(마지막으로 목록을 연 시각)을 대신한다.
-- 목록의 (New) 는 "아직 확인하지 않은 공지" 라는 뜻이라 방문 시각 하나로는 나타낼 수 없다 —
-- 목록을 열어만 두고 펼치지 않은 공지는 여전히 확인 전이기 때문이다.
-- 그 컬럼은 이 기능이 나가기 전에만 쓰였으므로 그대로 지운다.

-- CreateTable
CREATE TABLE "notice_reads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_reads_pkey" PRIMARY KEY ("id")
);

-- 같은 공지를 두 번 기록하지 않는다. 목록에서 "내가 읽은 공지" 를 한 번에 끌어오는
-- 조회(WHERE user_id AND notice_id IN (...))도 선행 컬럼부터 이 제약이 커버한다.
-- CreateIndex
CREATE UNIQUE INDEX "notice_reads_user_id_notice_id_key" ON "notice_reads"("user_id", "notice_id");

-- FK 는 Postgres 가 자동 인덱싱하지 않는다 (공지를 지울 때 함께 지우는 경로)
-- CreateIndex
CREATE INDEX "notice_reads_notice_id_idx" ON "notice_reads"("notice_id");

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropColumn
ALTER TABLE "users" DROP COLUMN "notices_seen_at";
