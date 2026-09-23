-- Sign in with Apple 지원: ProviderType 에 APPLE 추가
--
-- ALTER TYPE ... ADD VALUE 는 같은 트랜잭션 안에서 그 값을 바로 쓸 수 없다.
-- 그래서 이 마이그레이션은 enum 값 추가만 하고 끝낸다.
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'APPLE';
