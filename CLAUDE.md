# Picky — 모노레포 가이드

## 프로젝트 구조

pnpm + Turborepo 모노레포:

- `server/` — NestJS 11 + Prisma 7 (port **21000**)
- `app/` — Next.js 16, 사용자용 (port **21001**)
- `admin/` — Next.js 16, 관리자용 (port **21002**)

## 기술 스택

### 서버

- NestJS 11, Prisma 7, Supabase PostgreSQL
- Prisma 7 은 `schema.prisma` 에 연결 URL 을 쓸 수 없음
  - 런타임: `PrismaService` → `@prisma/adapter-pg` + `DATABASE_URL`(transaction pooler 6543, `sslmode=no-verify`)
  - 마이그레이션: `prisma.config.ts` → `DIRECT_URL`(session pooler 5432, `sslmode=require`)
  - 생성된 Client 는 `server/src/generated/prisma` (git 제외, `pnpm db:generate`)
- 인증: SNS 로그인(카카오/네이버/구글) + JWT (비밀번호 없음)
- 파일 저장: Supabase Storage (`SupabaseService`, 실제 사용 시점에 클라이언트 생성)

### 프론트

- Next.js 16 + React 19 + Tailwind CSS v4
- app: 모바일 전용 셸(`max-w-shell`, 430px)
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
  - `Account`: `providerType`(KAKAO / NAVER / GOOGLE) + `providerId`(제공자 회원번호) + `userId`
  - 로그인 시 `(providerType, providerId)` 로 계정을 찾고, 없으면 `User` + `Account` 를 함께 생성
  - 같은 유저가 같은 제공자를 두 번 연결하지 못하도록 `(userId, providerType)` 도 unique

## 컨벤션

- **app 은 모바일 전용 레이아웃** — `max-w-shell`(430px) 고정. `md:` / `lg:` 브레이크포인트 사용 금지
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
pnpm db:migrate   # prisma migrate dev
pnpm db:studio    # prisma studio
```

## 배포

- server → 클라우드타입 (루트 `Dockerfile`, 포트 21000, healthz `/api/health`)
  - **배포 설정·환경변수는 콘솔에서만 관리한다.** `.cloudtype/app.yaml` 을 만들지 말 것 —
    클라우드타입이 그 파일을 서비스 설정 전체로 받아 콘솔 환경변수를 덮어버린다(실제로 두 번 소실)
  - 같은 이유로 자동 배포 워크플로도 두지 않는다. 배포는 콘솔에서 수동으로 한다
- app / admin → Vercel (Root Directory 를 각각 `app`, `admin`)
