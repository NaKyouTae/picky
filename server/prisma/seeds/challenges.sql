-- 초기 콘텐츠 — 카테고리 3개 (챌린지는 어드민에서 직접 등록한다)
-- 실행: pnpm --filter @picky/server db:seed
--
-- 이미 있으면 건너뛰므로 여러 번 실행해도 안전합니다.
-- 카테고리는 enum 이 아니라 challenge_categories 테이블이다.

-- ── 카테고리 ─────────────────────────────────────────
-- 이름·설명은 디자인(Figma "메인" 4584:5334) 워딩이라 바뀔 수 있다.
-- id 는 바뀌면 안 된다 — 앱이 이 고정 UUID 로 뽑기를 요청한다
-- (app/src/lib/challenges.ts 의 FIXED_CATEGORIES 와 같은 값이어야 한다).
INSERT INTO "challenge_categories" (
  "id", "name", "emoji", "description", "status", "display_order", "created_at", "updated_at"
) VALUES
  ('11111111-1111-4111-8111-111111111111', '혼자서', '🙂', '오롯이 나에게 집중하는 시간',   'PUBLISHED', 1, now(), now()),
  ('22222222-2222-4222-8222-222222222222', '함께',   '💞', '같이니까, 뭐든 조금 더 재밌게', 'PUBLISHED', 2, now(), now()),
  ('33333333-3333-4333-8333-333333333333', '아기랑', '🧸', '평범한 하루도 새로운 추억으로', 'PUBLISHED', 3, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- ── 챌린지 ───────────────────────────────────────────
-- 기본 챌린지는 두지 않는다 — 콘텐츠는 어드민에서 직접 등록한다.
