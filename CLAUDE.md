# Picky — 모노레포 가이드

## 프로젝트 구조

pnpm + Turborepo 모노레포:

- `server/` — NestJS 11 + Prisma 7 (port **21000**)
- `app/` — Next.js 16, 사용자용 (port **21001**)
- `admin/` — Next.js 16, 관리자용 (port **21002**)
- `ios/Picky/` — 운영 웹을 띄우는 WKWebView 래퍼 (App Store 배포용)

## 기술 스택

### 서버

- NestJS 11, Prisma 7, Supabase PostgreSQL
- Prisma 7 은 `schema.prisma` 에 연결 URL 을 쓸 수 없음
  - 런타임: `PrismaService` → `@prisma/adapter-pg` + `DATABASE_URL`(transaction pooler 6543, `sslmode=no-verify`)
  - 마이그레이션: `prisma.config.ts` → `DIRECT_URL`(session pooler 5432, `sslmode=require`)
  - 생성된 Client 는 `server/src/generated/prisma` (git 제외, `pnpm db:generate`)
- 인증: SNS 로그인(카카오/네이버/Apple) + JWT (비밀번호 없음)
- 파일 저장: Supabase Storage (`SupabaseService`, 실제 사용 시점에 클라이언트 생성)
  - 버킷 셋: `picky`(public, 템플릿) · `challenge-proofs`(private, 인증 사진 — 임시) ·
    `collages`(private, 완성한 콜라주 — 등급 무관, 그룹당 한 장)

### 프론트

- Next.js 16 + React 19 + Tailwind CSS v4
- app: 모바일 전용 셸(`max-w-shell`, 390px — Figma 프레임 폭과 동일)
- admin: 사이드바 레이아웃

## DB 규칙

- **모든 테이블에 `created_at` / `updated_at` 필수** — Prisma 에서는
  `createdAt DateTime @default(now()) @map("created_at")`,
  `updatedAt DateTime @updatedAt @map("updated_at")`
- 컬럼/테이블은 snake_case (`@map` / `@@map`), Prisma 필드는 camelCase
- PK 는 `String @id @default(uuid()) @db.Uuid`
- 스키마 변경은 반드시 마이그레이션으로 (`pnpm db:migrate`). `db push` 는 로컬 실험용만

### 조회 쿼리는 인덱스를 먼저 확인할 것

- **WHERE / ORDER BY / JOIN 에 쓰이는 컬럼은 인덱스가 있어야 한다.** 새 쿼리를 추가하면
  그 조건 조합을 커버하는 인덱스가 있는지 먼저 확인하고, 없으면 마이그레이션으로 추가한다.
- **외래키는 Postgres 가 자동으로 인덱싱하지 않는다.** 관계 필드에는 `@@index([userId])` 를 직접 건다.
- 정렬이 함께 걸리는 목록 쿼리는 복합 인덱스로 (`@@index([status, createdAt])`).
  복합 인덱스는 **선행 컬럼부터** 쓰여야 타므로 컬럼 순서를 조건 순서에 맞춘다.
- 단건 조회용 조건 조합은 `@@unique` 로 (예: `@@unique([providerType, providerId])`) —
  인덱스와 중복 방지를 동시에 얻는다.
- 느린 쿼리가 의심되면 `EXPLAIN ANALYZE` 로 `Seq Scan` 이 나오는지 확인한다.
- 페이지네이션은 커서 기반 (`cursor` + `take`). `skip`(offset) 은 뒤 페이지로 갈수록 느려지므로 쓰지 않는다.

### N+1 쿼리를 만들지 말 것

- **목록을 돌면서 관계를 하나씩 조회하지 않는다.** 반복문 안의 `findUnique` / `findFirst` 는 N+1 신호다.
- 관계는 `include` / `select` 로 한 번에 가져온다 (Prisma 가 IN 쿼리로 묶어 준다).
  ```ts
  // ❌ N+1
  const users = await prisma.user.findMany();
  for (const user of users) {
    user.accounts = await prisma.account.findMany({ where: { userId: user.id } });
  }

  // ✅ 한 번에
  const users = await prisma.user.findMany({
    select: { id: true, email: true, accounts: { select: { providerType: true } } },
  });
  ```
- 목록에서 필요 없는 관계는 아예 부르지 않는다. `include` 남발도 비용이다 — 필요한 컬럼만 `select`.
- 여러 건을 개별 조회해야 하면 `where: { id: { in: ids } }` 로 한 번에 받고 메모리에서 매핑한다.
- 독립적인 쿼리는 `Promise.all` 로 묶고, 쓰기 여러 건은 `$transaction` 으로 묶는다.
- 개발 중에는 `PrismaService` 의 쿼리 로그로 요청 1건당 쿼리 수를 확인한다.

## 도메인 모델

- `User` 1 : N `Account` — SNS 계정 연결
  - `User`: `email`(unique, 필수), `name`(필수), `gender` / `ageRange` / `birthday`(선택)
  - `Account`: `providerType`(KAKAO / NAVER / APPLE) + `providerId`(제공자 회원번호) + `userId`
  - **Apple 로그인은 다른 둘과 성격이 다르다** — 이름을 최초 1회만 주고, 전화번호·약관 동의를
    주지 않는다. 연락처로 회원을 묶는 규칙(아래)이 적용되지 않아 늘 별도 회원이 된다.
    소셜 로그인만 제공하는 앱은 애플이 함께 요구하므로(심사 지침 4.8) 뺄 수 없다
  - 로그인 시 `(providerType, providerId)` 로 계정을 찾고, 없으면 `User` + `Account` 를 함께 생성
  - 같은 유저가 같은 제공자를 두 번 연결하지 못하도록 `(userId, providerType)` 도 unique

## 컨벤션

- **app 은 모바일 전용 레이아웃** — 디자인 프레임 폭은 390px(`--spacing-shell`). `md:` / `lg:` 브레이크포인트 사용 금지
  - 예외는 앱 셸 하나뿐 — `app-shell`(globals.css)은 폰에서 화면을 꽉 채우고, 640px 이상에서만
    390px 프레임으로 좁아진다. 폭을 항상 390px 로 잠그면 그보다 넓은 폰(402·430·440pt)에서
    좌우에 canvas 색 띠가 남는다
  - safe-area 는 `safe-top` / `safe-bottom` 유틸리티
  - 터치 타깃 최소 44px, input `font-size: 16px`(iOS 확대 방지), 높이는 `dvh`
- **BFF 프록시 패턴** — 브라우저는 `/api/*`(Next Route Handler) 만 호출. 서버 주소·토큰은 노출하지 않음
- 서버 API 는 `/api` 프리픽스 + 전역 `ValidationPipe`(whitelist) + 공통 예외 필터
- 브라우저에 노출할 값만 `NEXT_PUBLIC_` 접두사
- 인증 토큰은 httpOnly 쿠키 (프론트 도메인에 저장 → SNS 콜백도 프론트로 받는다)

## 실행

```bash
pnpm dev          # 3개 앱 동시 실행
pnpm dev:server   # 서버만 (21000)
pnpm dev:app      # App만 (21001)
pnpm dev:admin    # Admin만 (21002)

pnpm build        # 전체 빌드
pnpm lint         # 전체 lint
pnpm typecheck    # 전체 타입체크

pnpm db:generate  # prisma generate
pnpm db:migrate   # prisma migrate dev (새 마이그레이션을 만들 때)
pnpm db:studio    # prisma studio
```

`pnpm dev` / `pnpm dev:server` 는 서버를 띄우기 전에 `db:sync`(= `migrate deploy` + `db:seed`)
를 먼저 돌린다. 그래서 스키마와 기본 콘텐츠(카테고리 3개·챌린지 30개)가 항상 준비된 상태로
시작한다. 시드 SQL 은 `ON CONFLICT DO NOTHING` 이라 여러 번 실행해도 데이터가 늘지 않는다.
DB 에 닿지 못하면 경고만 남기고 서버는 그대로 뜬다 (DB 없이도 기동되던 기존 동작 유지).

## 배포

- server → 클라우드타입 (루트 `Dockerfile`, 포트 21000, healthz `/api/health`)
  - **배포 설정·환경변수는 콘솔에서만 관리한다.** `.cloudtype/app.yaml` 을 만들지 말 것 —
    클라우드타입이 그 파일을 서비스 설정 전체로 받아 콘솔 환경변수를 덮어버린다(실제로 두 번 소실)
  - 같은 이유로 자동 배포 워크플로도 두지 않는다. 배포는 콘솔에서 수동으로 한다
- app / admin → Vercel (Root Directory 를 각각 `app`, `admin`)
- iOS → App Store (`ios/Picky`, 번들 `kr.spectrify.picky`). 자세한 절차는 [ios/README.md](ios/README.md)
  - 앱은 화면을 갖지 않고 `https://picky.spectrify.kr` 를 그대로 띄운다 — **웹을 먼저 배포**할 것
  - 웹과 맞물린 곳이 네 군데 있다. 한쪽만 고치면 앱에서 깨진다:
    스플래시(배경 `#121212` · 마크 120px), 콜라주 저장(`saveImage` 브리지),
    인앱결제(`iap` 브리지), 결제 앱 스킴(`picky://`)
  - `isNativeApp()`(`app/src/lib/native-app.ts`) 은 `saveImage` 핸들러의 존재로 앱을 판별한다.
    WKWebView 에서 `<a download>` 처럼 동작하지 않는 API 를 쓸 때는 이 함수로 갈라 준다

## 결제

**플랫폼마다 결제 수단이 다르다. 새로 유료 기능을 붙일 때 반드시 갈라 줄 것.**

|             | 결제 수단                     | 적립 경로                                              |
| ----------- | ----------------------------- | ------------------------------------------------------ |
| 웹 브라우저 | 토스페이먼츠 결제창           | `POST /memberships/orders` → 결제창 → `orders/confirm` |
| iOS 앱      | App Store 인앱결제 (StoreKit) | StoreKit 결제 → `POST /memberships/orders/apple`       |

- **앱 안에서 열리는 디지털 콘텐츠를 외부 결제로 팔면 심사에서 반려된다**
  (App Review Guideline 3.1.1). 그래서 앱에서는 토스 결제창을 띄우지 않는다 —
  `/membership` 과 `/membership/checkout` 둘 다 앱에서는 인앱결제 화면으로 갈아끼운다.
- 브리지가 없는 예전 앱 빌드에서 **토스로 되돌리지 말 것.** 업데이트를 안내한다
  (`MembershipIapUnavailable`). "웹에서 사세요" 같은 유도 문구도 넣으면 안 된다(안티스티어링).
- 영수증 검증은 서버가 Apple 루트 인증서까지 직접 한다 — 앱이 보낸 상품 ID·구매 여부를
  그대로 믿지 않는다 (`server/src/memberships/apple-iap.service.ts`).
- **거래는 서버 적립이 끝난 뒤에 finish 한다.** 먼저 닫으면 적립 실패 시 영수증을 다시 얻을 수
  없다. 닫지 않은 거래는 결제 화면에서 `restore` 로 꺼내 재적립한다.
- 중복 적립은 `membership_orders.apple_transaction_id` 의 unique 제약이 막는다 —
  같은 영수증을 여러 번 보내도 기간은 한 번만 늘어난다.
- 회원권마다 App Store 상품 ID 를 어드민에서 연결해야 앱에서 팔린다 (`appleProductId`).
- Android 는 아직 앱이 없다. 붙일 때는 Google Play 결제를 쓰고,
  `MembershipStore` 에 `GOOGLE` 을 추가해 같은 구조로 간다.

### 환불

- **환불 창구가 스토어마다 다르다.** 웹(토스)은 우리가 취소하고, App Store 결제는 Apple 이
  처리한다 — 우리 서버에서 취소할 방법이 아예 없다. 결제 내역·환불정책에 이 구분을 드러낸다.
- Apple 이 환불을 승인하면 **App Store Server Notifications V2** 의 `REFUND` 알림으로 들어온다
  (`POST /api/memberships/apple/notifications`, 로그인 가드 없음 — JWS 서명이 곧 인증).
  이 알림을 받지 않으면 환불된 회원이 이용 기간을 그대로 쓴다.
- 환불이 들어오면 주문을 `REFUNDED` 로 바꾸고 **그 사용자의 이용 기간을 처음부터 다시 계산한다**
  (`rebuildPeriods`). 한 건만 손대면 안 된다 — 이용권은 `max(endsAt)` 로 판단하는데 중간 주문이
  환불돼도 뒤 주문의 `endsAt` 이 그대로라 기간이 전혀 줄지 않는다.
- `REFUND_REVERSED`(Apple 이 환불을 되돌린 경우)면 `PAID` 로 돌리고 다시 계산한다.

### 유료 회원에게만 열리는 것

- **유료 템플릿**(`sticker_templates.is_paid`) — 잠긴 카드를 누르면 구매 화면으로 보낸다
- **지난 콜라주 다시 받기** — '완료한 챌린지' 에서 보관본을 내려받는 것
- **콜라주 보관 자체는 유료가 아니다.** '콜라주 완성' 을 누르면 등급과 무관하게 `collages`
  버킷에 올라간다 — 무료 사용자도 그 자리에서는 자기 콜라주를 받아 가기 때문이다.
  나누는 지점은 **나중에 다시 받을 때** 하나뿐이다
- **기간이 끝나면 다시 막힌다.** 판정은 한 곳에서만 한다 —
  `MembershipsService.assertActive()`(없거나 만료면 403). 만료돼도 파일은 지우지 않으므로
  다시 구매하면 예전 콜라주가 그대로 돌아온다. 새 유료 기능을 붙일 때도 이 함수를 쓸 것
