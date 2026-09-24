-- 마이페이지의 '신규 공지' 점 — 공지를 마지막으로 열어 본 시각을 계정에 남긴다.
--
-- 기기(localStorage)가 아니라 계정에 두는 이유: 폰을 바꾸거나 앱을 지웠다 깔아도 읽은 상태가
-- 유지되어야 하고, 마이페이지가 서버에서 그려지므로 점이 뒤늦게 깜빡이며 나타나지 않는다.
-- 기존 회원은 NULL 이라 공개된 공지가 있으면 점이 한 번 붙는다 (열어 보면 사라진다).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "notices_seen_at" TIMESTAMP(3);

-- 신규 공지 점: WHERE status AND published_at <= now() ORDER BY published_at desc LIMIT 1.
-- 목록용 인덱스는 is_pinned 가 가운데 끼어 고정/일반 두 구간을 따로 봐야 하므로 따로 둔다.
-- CreateIndex
CREATE INDEX "notices_status_published_at_idx" ON "notices"("status", "published_at");
