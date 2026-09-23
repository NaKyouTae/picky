-- iOS 앱의 App Store 인앱결제 지원.
--
-- 앱 안에서 열리는 유료 템플릿은 외부 결제로 팔 수 없어(App Review Guideline 3.1.1)
-- iOS 앱은 인앱결제를 쓰고, 웹은 그대로 토스페이먼츠를 쓴다.
-- 기존 주문은 전부 토스 결제라 store 기본값을 WEB 으로 두면 그대로 맞는다.

-- CreateEnum
CREATE TYPE "MembershipStore" AS ENUM ('WEB', 'APPLE');

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "apple_product_id" VARCHAR(120);

-- AlterTable
ALTER TABLE "membership_orders" ADD COLUMN     "apple_original_transaction_id" VARCHAR(64),
ADD COLUMN     "apple_transaction_id" VARCHAR(64),
ADD COLUMN     "store" "MembershipStore" NOT NULL DEFAULT 'WEB';

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_apple_product_id_key" ON "membership_plans"("apple_product_id");

-- 같은 App Store 거래로 이용 기간이 두 번 늘어나는 것을 DB 차원에서 막는다.
-- CreateIndex
CREATE UNIQUE INDEX "membership_orders_apple_transaction_id_key" ON "membership_orders"("apple_transaction_id");
