-- 할인 전 정가 — 결제 화면에서 판매 금액 옆에 취소선으로 보여 준다.
--
-- 청구 금액은 그대로 price 다. 이 값은 표시용이라 NULL 을 허용하고(할인 중이 아닐 때),
-- 기존 회원권은 전부 NULL 로 남아 예전과 똑같이 보인다.
-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "list_price" INTEGER;
