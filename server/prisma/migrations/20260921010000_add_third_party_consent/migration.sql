-- 개인정보 제3자 제공 동의 추가 (선택 동의 — 철회 가능).
-- ADD VALUE 는 같은 트랜잭션 안에서 그 값을 쓸 수 없으므로 컬럼 추가만 함께 한다.

ALTER TYPE "ConsentType" ADD VALUE IF NOT EXISTS 'THIRD_PARTY';

ALTER TABLE "users" ADD COLUMN "third_party_agreed_at" TIMESTAMP(3);
