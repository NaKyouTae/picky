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
├── Dockerfile            # server 이미지 (build context = 저장소 루트)
├── .cloudtype/app.yaml   # 클라우드타입 배포 설정
├── server/               # @picky/server
│   ├── prisma/schema.prisma
│   ├── prisma.config.ts  # Prisma 7 설정 (migrate 용 DIRECT_URL)
│   ├── src/common/prisma      # PrismaService (pg 드라이버 어댑터)
│   ├── src/common/supabase    # SupabaseService (Storage)
│   └── src/health             # /api/health
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

### server → 클라우드타입

배포 설정은 [.cloudtype/app.yaml](.cloudtype/app.yaml) 에 있습니다 (`app: dockerfile`, 포트 `21000`, 헬스체크 `/api/health`).
루트 [Dockerfile](Dockerfile) 이 모노레포 전체를 build context 로 사용해 `@picky/server` 만 빌드합니다.

#### 환경변수 — 콘솔에서만 관리합니다

`app.yaml` 의 `env` 목록은 컨테이너 환경변수를 **통째로 덮어씁니다.** 일부만 적어 두면 콘솔에서
입력한 나머지가 배포 때마다 지워지므로, `app.yaml` 에는 `env` 선언을 두지 않고 콘솔
**환경변수** 화면을 단일 소스로 씁니다. **시크릿 탭도 쓰지 않습니다.**

> ⚠️ `app.yaml` 에 `env:` 블록을 다시 추가하지 마세요. 추가하는 순간 콘솔 값이 전부 날아갑니다.

콘솔에 등록할 값 19개 — 운영 전용 값은 로컬 `server/.env` 와 다르니 주의:

| 키 | 값 |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `21000` |
| `CORS_ORIGINS` | `https://picky.spectrify.kr,http://localhost:21001,http://localhost:21002` |
| `SUPABASE_STORAGE_BUCKET` | `picky` |
| `JWT_EXPIRES_IN` | `7d` |
| `KAKAO_REDIRECT_URI` | `https://picky.spectrify.kr/auth/kakao/callback` |
| `GOOGLE_REDIRECT_URI` | `https://picky.spectrify.kr/auth/google/callback` |
| `DATABASE_URL` · `DIRECT_URL` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `JWT_SECRET` · `ADMIN_TOKEN` · `ADMIN_USERNAME` · `ADMIN_PASSWORD` · `KAKAO_REST_API_KEY` · `KAKAO_CLIENT_SECRET` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | `server/.env` 값을 그대로 |

- 카카오/구글 `REDIRECT_URI` 는 로컬 `.env` 의 `localhost` 값을 쓰면 안 되고, 각 제공자 콘솔에
  등록한 Redirect URI 와 문자 단위로 같아야 합니다.
- `SUPABASE_ANON_KEY` 는 서버 코드가 읽지 않으므로 설정하지 않아도 됩니다.
- `ADMIN_TOKEN` / `ADMIN_PASSWORD` 는 로컬과 다른 값을 쓰는 편이 안전합니다.

#### 배포 절차

1. **내 GitHub 저장소 배포하기** → `NaKyouTae/picky` 선택 (서브 디렉토리는 비워 둠)
2. `.cloudtype/app.yaml` 을 자동으로 읽어 빌드 설정(포트·Dockerfile·헬스체크)이 채워집니다
3. 콘솔 **환경변수** 화면에서 위 19개를 입력
4. 프론트 도메인이 바뀌면 콘솔의 `CORS_ORIGINS` 값을 해당 도메인으로 수정

마이그레이션은 배포 전 로컬 또는 CI 에서 `pnpm --filter @picky/server db:deploy` 로 적용합니다.

#### 자동 배포 (GitHub Actions)

클라우드타입은 GitHub 연동만으로는 재배포되지 않아 [.github/workflows/deploy-server.yml](.github/workflows/deploy-server.yml) 이
`main` 푸시(서버 관련 경로 변경 시) 또는 Actions 탭의 수동 실행으로 배포를 트리거합니다.
배포 설정은 `.cloudtype/app.yaml` 을 그대로 사용하고, 배포 후 `/api/health` 가 200 이 될 때까지 확인합니다.

저장소 **Settings → Secrets and variables → Actions** 에 아래를 등록해야 동작합니다 (없으면 배포를 건너뜁니다).

| 구분 | 이름 | 값 |
| --- | --- | --- |
| Secret | `CLOUDTYPE_TOKEN` | 클라우드타입 콘솔 → 설정 → API Key |
| Variable | `CLOUDTYPE_PROJECT` | `스페이스/프로젝트` (예: `nakyoutae/picky`) |
| Variable | `CLOUDTYPE_STAGE` | (선택) 기본값 `main` |

로컬에서 이미지 확인:

```bash
docker build -t picky-server .
docker run -p 21000:21000 -e DATABASE_URL="..." picky-server
```

### app / admin → Vercel

프로젝트를 2개 만들고 각각 **Root Directory** 를 `app`, `admin` 으로 지정합니다.
빌드 명령은 각 워크스페이스의 `vercel.json` 에 정의되어 있습니다 (turbo 필터 빌드).
`API_BASE_URL` 은 Cloudtype 서버 주소로 설정합니다.
