-- 칸(챌린지)별 완료 시각.
-- '다시 뽑기' 는 현재 칸의 challenge_id 만 교체하고, '완료하기' 는 이 값을 채운 뒤
-- 다음 칸을 새로 뽑는다. 마지막 칸을 완료하면 그룹이 완료된다.
ALTER TABLE "challenge_group_items" ADD COLUMN "completed_at" TIMESTAMP(3);
