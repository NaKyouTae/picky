# picky

순간 — Turborepo 모노레포

## 구성

| 워크스페이스 | 설명                            | 포트      | 배포      |
| ------------ | ------------------------------- | --------- | --------- |
| `server`     | NestJS 11 + Prisma 7 + Supabase | **21000** | Cloudtype |
| `app`        | Next.js 16 (모바일 UI first)    | **21001** | Vercel    |
| `admin`      | Next.js 16 (관리자)             | **21002** | Vercel    |

```
picky/
├── turbo.json            # 태스크 파이프라인
├── pnpm-workspace.yaml
├── server/               # @picky/server
│   ├── prisma/schema.prisma
│   ├── prisma.config.ts  # Prisma 7 설정 (migrate 용 DIRECT_URL)
│   ├── src/common/prisma      # PrismaService (pg 드라이버 어댑터)
│   ├── src/common/supabase    # SupabaseService (Storage)
│   ├── src/health             # /api/health
│   └── Dockerfile             # Cloudtype 배포용
├── app/                  # @picky/app
│   ├── src/app/api/[...path]  # BFF 프록시 → NestJS
│   ├── src/lib/api.ts         # 서버 컴포넌트용 API 클라이언트
│   └── src/components         # 하단 탭바 등 모바일 셸
├── admin/                # @picky/admin (ADMIN_TOKEN 자동 첨부)
└── packages/             # 공용 패키지 자리
```

## 시작하기

```bash
pnpm install

# 환경변수 준비
cp server/.env.example server/.env
cp app/.env.example app/.env.local
cp admin/.env.example admin/.env.local

pnpm db:generate   # Prisma Client 생성 (server/src/generated)
pnpm dev           # 3개 앱 동시 실행
```

- App: http://localhost:21001
- Admin: http://localhost:21002
- API: http://localhost:21000/api · Swagger: http://localhost:21000/api/docs (개발 모드)

## 명령어

```bash
pnpm dev            # 전체 개발 서버
pnpm dev:server     # 서버만
pnpm dev:app        # App만
pnpm dev:admin      # Admin만

pnpm build          # 전체 빌드 (turbo 캐시)
pnpm lint           # 전체 lint
pnpm typecheck      # 전체 타입체크
pnpm format         # prettier

pnpm db:generate    # prisma generate
pnpm db:migrate     # prisma migrate dev
pnpm db:push        # prisma db push
pnpm db:studio      # prisma studio
```

## 데이터베이스 (Supabase + Prisma 7)

Prisma 7 부터 연결 URL 은 `schema.prisma` 가 아닌 곳에서 관리합니다.

- **런타임**: `PrismaService` 가 `@prisma/adapter-pg` 어댑터에 `DATABASE_URL`(transaction pooler, 6543) 을 전달
- **마이그레이션**: `prisma.config.ts` 의 `datasource.url` 이 `DIRECT_URL`(direct connection, 5432) 사용
- 생성된 Client 는 `server/src/generated/prisma` (git 제외, `pnpm db:generate` 로 재생성)

## 컨벤션

- **모바일 UI first** — `app` 은 `max-w-shell`(430px) 모바일 셸 고정. 데스크톱 전용 분기 없이 모바일 기준으로 작성
  - safe-area: `safe-top` / `safe-bottom` 유틸리티 사용
  - 터치 타깃 최소 44px, input `font-size: 16px` (iOS 확대 방지), `100dvh` 사용
- **BFF 프록시 패턴** — 브라우저는 `/api/*`(Next Route Handler) 만 호출하고, 서버 주소·토큰은 노출하지 않음
- 서버 API 는 `/api` 프리픽스 + 전역 `ValidationPipe`(whitelist) + 공통 예외 필터
- 환경변수 중 브라우저 노출이 필요한 값만 `NEXT_PUBLIC_` 접두사

## 배포

### server → Cloudtype

Dockerfile 기반 배포 (build context 는 **저장소 루트**):

| 항목            | 값                  |
| --------------- | ------------------- |
| Dockerfile 경로 | `server/Dockerfile` |
| 컨텍스트        | `/` (저장소 루트)   |
| 포트            | `21000`             |
| 헬스체크        | `/api/health`       |

환경변수는 Cloudtype 콘솔에 `server/.env.example` 항목을 등록합니다.
마이그레이션은 배포 전 로컬 또는 CI 에서 `pnpm --filter @picky/server db:deploy` 로 적용합니다.

### app / admin → Vercel

프로젝트를 2개 만들고 각각 **Root Directory** 를 `app`, `admin` 으로 지정합니다.
빌드 명령은 각 워크스페이스의 `vercel.json` 에 정의되어 있습니다 (turbo 필터 빌드).
`API_BASE_URL` 은 Cloudtype 서버 주소로 설정합니다.
