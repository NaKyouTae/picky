-- 환불 시각 — Apple 이 알려 주는 revocationDate 를 그대로 남긴다.
-- AlterTable
ALTER TABLE "membership_orders" ADD COLUMN     "refunded_at" TIMESTAMP(3);
