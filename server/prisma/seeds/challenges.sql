-- 초기 콘텐츠 — 카테고리 3개 + 카테고리별 챌린지 10개 (모두 공개 상태)
-- 실행: pnpm --filter @picky/server db:seed
--
-- 이미 있으면 건너뛰므로 여러 번 실행해도 안전합니다.
-- 카테고리는 enum 이 아니라 challenge_categories 테이블이고,
-- 아래 VALUES 의 SOLO/COUPLE/KIDS 는 고정 UUID 로 옮겨 id 를 찾는다.

-- ── 카테고리 ─────────────────────────────────────────
-- 이름·설명은 디자인(Figma "메인" 4584:5334) 워딩이다. 바뀔 수 있는 값이라
-- 챌린지를 붙일 때는 이름이 아니라 아래 고정 UUID 로 조인한다.
INSERT INTO "challenge_categories" (
  "id", "name", "emoji", "description", "status", "display_order", "created_at", "updated_at"
) VALUES
  ('11111111-1111-4111-8111-111111111111', '혼자서', '🙂', '오롯이 나에게 집중하는 시간',   'PUBLISHED', 1, now(), now()),
  ('22222222-2222-4222-8222-222222222222', '함께',   '💞', '같이니까, 뭐든 조금 더 재밌게', 'PUBLISHED', 2, now(), now()),
  ('33333333-3333-4333-8333-333333333333', '아기랑', '🧸', '평범한 하루도 새로운 추억으로', 'PUBLISHED', 3, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- ── 챌린지 ───────────────────────────────────────────
-- 챌린지가 갖는 내용은 제목 한 줄뿐이다 (카테고리 · 상태 · 제목).

INSERT INTO "challenges" (
  "id", "category_id", "status", "title", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  cat.id,
  'PUBLISHED'::"ChallengeStatus",
  v.title,
  now(),
  now()
FROM (
  VALUES
    -- 혼자서
    ('SOLO', '한 번도 안 들어본 장르 플레이리스트 듣기'),
    ('SOLO', '집에서 30분 거리 낯선 동네 걷기'),
    ('SOLO', '표지만 보고 고른 책 한 챕터 읽기'),
    ('SOLO', '안 해본 요리 하나 만들어 먹기'),
    ('SOLO', '다큐멘터리 한 편 끝까지 보기'),
    ('SOLO', '카페에서 한 시간 아무것도 안 하기'),
    ('SOLO', '1년 뒤의 나에게 편지 쓰기'),
    ('SOLO', '한 정거장 먼저 내려 걸어가기'),
    ('SOLO', '딱 한 칸만 완벽하게 정리하기'),
    ('SOLO', '오늘 예쁘다고 느낀 것 열 장 찍기'),

    -- 함께
    ('COUPLE', '서로 좋아하는 영화 바꿔 시청하기'),
    ('COUPLE', '우리 동네 떡볶이 맛집 다녀오기'),
    ('COUPLE', '눈 감고 찍은 역에 내려보기'),
    ('COUPLE', '한 명은 눈 감고 요리하기'),
    ('COUPLE', '인생네컷 찍어 각자 지갑에 넣기'),
    ('COUPLE', '정해진 금액으로 서로 선물 사주기'),
    ('COUPLE', '해 뜨는 거 같이 보기'),
    ('COUPLE', '서로의 애창곡 불러주기'),
    ('COUPLE', '처음 만난 날 갔던 곳 다시 가보기'),
    ('COUPLE', '고마운 것 열 가지 적어 교환하기'),

    -- 아기랑
    ('KIDS', '아이가 정한 규칙으로 하루 놀기'),
    ('KIDS', '같이 쿠키 굽기'),
    ('KIDS', '공원에서 자연물 보물찾기'),
    ('KIDS', '서로 얼굴 그려주기'),
    ('KIDS', '아이가 지어낸 이야기로 책 만들기'),
    ('KIDS', '자전거 타고 한 정거장 가보기'),
    ('KIDS', '거실에 이불 텐트 치고 하룻밤'),
    ('KIDS', '아이가 고른 재료로 저녁 만들기'),
    ('KIDS', '버스 타고 처음 가보는 놀이터 가기'),
    ('KIDS', '카메라를 아이에게 맡기기')
) AS v(category, title)
-- 카테고리는 고정 UUID 로 묶는다 — 이름은 디자인에 따라 바뀔 수 있는 값이라
-- 이름으로 조인하면 워딩을 고칠 때마다 시드가 조용히 0건이 된다.
JOIN "challenge_categories" cat
  ON cat.id = CASE v.category
       WHEN 'SOLO'   THEN '11111111-1111-4111-8111-111111111111'::uuid
       WHEN 'COUPLE' THEN '22222222-2222-4222-8222-222222222222'::uuid
       WHEN 'KIDS'   THEN '33333333-3333-4333-8333-333333333333'::uuid
     END
WHERE NOT EXISTS (
  SELECT 1 FROM "challenges" c WHERE c.title = v.title
);
