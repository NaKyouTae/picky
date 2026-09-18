import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // 마이그레이션은 pooler(6543) 가 아닌 direct connection(5432) 사용
    // (빌드 타임 `prisma generate` 는 URL 없이도 동작하도록 빈 문자열 fallback)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
