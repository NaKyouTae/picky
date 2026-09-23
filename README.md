# picky

순간 — Turborepo 모노레포

## 구성

| 워크스페이스 | 설명                            | 포트      | 배포      |
| ------------ | ------------------------------- | --------- | --------- |
| `server`     | NestJS 11 + Prisma 7 + Supabase | **21000** | Cloudtype |
| `app`        | Next.js 16 (모바일 UI first)    | **21001** | Vercel    |
| `admin`      | Next.js 16 (관리자)             | **21002** | Vercel    |
| `ios/Picky`  | 운영 웹을 띄우는 WKWebView 래퍼 | —         | App Store |

```
picky/
├── turbo.json            # 태스크 파이프라인
├── pnpm-workspace.yaml
├── Dockerfile            # server 이미지 (build context = 저장소 루트)
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
├── ios/Picky/            # iOS 래퍼 앱 (Xcode) — ios/README.md
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

- **모바일 UI first** — `app` 은 모바일 셸 기준으로 작성합니다. 디자인 프레임 폭은 390px(`--spacing-shell`)
  - 셸(`app-shell`)은 폰에서 화면을 꽉 채우고, 640px 이상에서만 390px 프레임으로 좁아집니다.
    폭을 항상 390px 로 잠그면 그보다 넓은 폰(402·430·440pt)에서 좌우에 canvas 색 띠가 남습니다
  - safe-area: `safe-top` / `safe-bottom` 유틸리티 사용
  - 터치 타깃 최소 44px, input `font-size: 16px` (iOS 확대 방지), `100dvh` 사용
- **BFF 프록시 패턴** — 브라우저는 `/api/*`(Next Route Handler) 만 호출하고, 서버 주소·토큰은 노출하지 않음
- 서버 API 는 `/api` 프리픽스 + 전역 `ValidationPipe`(whitelist) + 공통 예외 필터
- 환경변수 중 브라우저 노출이 필요한 값만 `NEXT_PUBLIC_` 접두사

## 배포

### server → 클라우드타입

**배포 설정은 저장소에 두지 않고 클라우드타입 콘솔에서만 관리합니다.**
루트 [Dockerfile](Dockerfile) 이 모노레포 전체를 build context 로 사용해 `@picky/server` 만 빌드합니다.

> ⚠️ `.cloudtype/app.yaml` 을 다시 만들지 마세요.
>
> 클라우드타입은 이 파일을 **서비스 설정 전체**로 받습니다. `env` 를 일부만 적으면 나머지가,
> 아예 적지 않으면 **전부** 배포 때마다 지워집니다. 실제로 두 번 날아갔습니다
> (`env` 일부만 선언 → 나머지 소실 / `env` 블록 제거 → 전체 소실).
>
> 같은 이유로 `cloudtype-github-actions/deploy` 액션도 쓰지 않습니다. 이 액션은
> `file`·`json`·`yaml` 중 하나로 **설정 전체를 반드시 함께 보내야** 하므로, 설정을 건드리지 않는
> 자동 배포가 불가능합니다.

#### 환경변수 — 콘솔 [환경변수] 화면이 단일 소스

**시크릿 탭도 쓰지 않습니다.** 모든 값을 [환경변수] 화면에 평문으로 입력합니다.

콘솔에 등록할 값 22개 — 운영 전용 값은 로컬 `server/.env` 와 다르니 주의:

| 키                                                                                                                                                                                                                                             | 값                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                                                                                                                                                                     | `production`                                                               |
| `PORT`                                                                                                                                                                                                                                         | `21000`                                                                    |
| `CORS_ORIGINS`                                                                                                                                                                                                                                 | `https://picky.spectrify.kr,http://localhost:21001,http://localhost:21002` |
| `KAKAO_REDIRECT_URI`                                                                                                                                                                                                                           | `https://picky.spectrify.kr/auth/kakao/callback`                           |
| `GOOGLE_REDIRECT_URI`                                                                                                                                                                                                                          | `https://picky.spectrify.kr/auth/google/callback`                          |
| `APPLE_REDIRECT_URI`                                                                                                                                                                                                                           | `https://picky.spectrify.kr/auth/apple/callback`                           |
| `APPLE_CLIENT_ID` · `APPLE_TEAM_ID` · `APPLE_KEY_ID` · `APPLE_PRIVATE_KEY`                                                                                                                                                                     | Apple Developer 에서 발급 (`server/.env.example` 참고)                     |
| `DATABASE_URL` · `DIRECT_URL` · `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `JWT_SECRET` · `ADMIN_TOKEN` · `ADMIN_USERNAME` · `ADMIN_PASSWORD` · `KAKAO_REST_API_KEY` · `KAKAO_CLIENT_SECRET` · `KAKAO_ADMIN_KEY` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | `server/.env` 값을 그대로                                                  |

- 카카오/구글 `REDIRECT_URI` 는 로컬 `.env` 의 `localhost` 값을 쓰면 안 되고, 각 제공자 콘솔에
  등록한 Redirect URI 와 문자 단위로 같아야 합니다.
- `SUPABASE_ANON_KEY` 는 서버 코드가 읽지 않으므로 설정하지 않아도 됩니다.
- Storage 버킷 이름과 JWT 만료 기간(`7d`)은 환경마다 다르지 않아 코드에 고정했습니다 —
  환경변수로 넣지 않습니다. 버킷은 Supabase 콘솔에서 미리 만들어 두세요:
  `picky`(public, 콜라주 템플릿) · `challenge-proofs`(private, 인증 사진) ·
  `collages`(private, 완성한 콜라주 — 다시 받는 것만 유료 회원 전용).
- `ADMIN_TOKEN` / `ADMIN_PASSWORD` 는 로컬과 다른 값을 쓰는 편이 안전합니다.

#### 배포 절차 (콘솔에서 수동)

1. **내 GitHub 저장소 배포하기** → `NaKyouTae/picky` 선택 (서브 디렉토리는 비워 둠)
2. 빌드 설정을 콘솔에서 직접 지정: `dockerfile` / 포트 `21000` / 헬스체크 `/api/health`
3. 콘솔 **환경변수** 화면에서 위 17개를 입력
4. 이후 배포는 콘솔의 **배포 내역 → 재배포**(또는 커밋 선택 배포)로 실행합니다
5. 프론트 도메인이 바뀌면 콘솔의 `CORS_ORIGINS` 값을 해당 도메인으로 수정

마이그레이션은 배포 전 로컬에서 `pnpm --filter @picky/server db:deploy` 로 적용합니다.

#### 자동 배포는 쓰지 않습니다

푸시할 때마다 배포되게 하려면 위 액션이 설정 전체를 함께 밀어야 하고, 그때 콘솔 환경변수가
지워집니다. 그래서 자동 배포 워크플로를 제거했습니다 — **배포는 콘솔에서 직접** 합니다.

자동 배포를 되살리려면 설정을 건드리지 않고 재배포만 트리거하는 방법(예: 콘솔 CLI 탭의
`ctcli`)을 먼저 확인해야 합니다.
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

### iOS → App Store

`ios/Picky` 는 화면을 갖지 않고 `https://picky.spectrify.kr` 를 그대로 띄우는 WKWebView
래퍼입니다. 번들 ID 는 `kr.spectrify.picky`, 최소 버전은 iOS 17.0 입니다.

앱에 새 빌드를 올리기 전에 **웹을 먼저 배포**하세요 — 앱은 운영 URL 을 그대로 봅니다.
버전 올리기·아카이브·심사 제출 절차와, 웹과 맞물려 있어 한쪽만 고치면 깨지는 부분
(스플래시·콜라주 저장·결제 앱 스킴)은 [ios/README.md](ios/README.md) 에 있습니다.
