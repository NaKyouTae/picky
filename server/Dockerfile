# Cloudtype 배포용 Dockerfile
# build context 는 저장소 루트 (Dockerfile 경로: server/Dockerfile)
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat openssl
ENV CI=true
WORKDIR /app

# ── 1) 모노레포에서 server 워크스페이스만 추출 ──────────────
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @picky/server --docker

# ── 2) 빌드 (dev 의존성 포함) ─────────────────────────────
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @picky/server db:generate && pnpm --filter @picky/server build

# ── 3) 런타임 의존성만 별도 설치 ──────────────────────────
FROM base AS prod-deps
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod

# ── 4) 런타임 ────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=21000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/prisma.config.ts ./server/prisma.config.ts
COPY --from=builder /app/server/package.json ./server/package.json

WORKDIR /app/server
EXPOSE 21000
CMD ["node", "dist/main"]
