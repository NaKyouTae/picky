-- Google Play 인앱결제 — 안드로이드 앱 결제 경로.
--
-- Apple 쪽(20260923120000_add_apple_iap)과 같은 모양이다: 플랜에 스토어 상품 ID 를 달고,
-- 주문에 그 스토어의 구매 식별자를 unique 로 남겨 중복 적립을 막는다.
-- 상품 ID 를 스토어별로 따로 두는 이유는 Play 와 App Store 에 각각 등록하기 때문이다.

-- AlterEnum
ALTER TYPE "MembershipStore" ADD VALUE 'GOOGLE';

-- AlterTable: 플랜에 Play 상품 ID
ALTER TABLE "membership_plans" ADD COLUMN "google_product_id" VARCHAR(120);

-- AlterTable: 주문에 Play 구매 토큰 · 주문번호
--
-- google_purchase_token 이 멱등 키다. Play 토큰은 수백 자에 이르러 길이를 넉넉히 잡는다.
ALTER TABLE "membership_orders" ADD COLUMN "google_purchase_token" VARCHAR(1000);
ALTER TABLE "membership_orders" ADD COLUMN "google_order_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_google_product_id_key" ON "membership_plans"("google_product_id");
CREATE UNIQUE INDEX "membership_orders_google_purchase_token_key" ON "membership_orders"("google_purchase_token");
