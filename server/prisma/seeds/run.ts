import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/**
 * 시드 SQL 실행기 — `pnpm db:seed`
 * 마이그레이션과 같은 direct connection(5432) 을 쓴다.
 * SQL 자체가 "같은 제목이 있으면 건너뛰기" 라서 여러 번 실행해도 안전하다.
 */
async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL 또는 DATABASE_URL 환경변수가 필요합니다.');
  }

  const file = path.join(__dirname, 'challenges.sql');
  const sql = readFileSync(file, 'utf8');

  // Supabase 풀러는 자체 서명 인증서를 쓴다. Prisma 와 달리 node-postgres 는
  // sslmode=require 에서 체인을 검증하므로 no-verify 로 바꿔 준다.
  // (ssl 옵션을 따로 넘겨도 URL 에서 파싱한 값이 덮어쓰므로 URL 자체를 고친다)
  const client = new Client({
    connectionString: connectionString.replace('sslmode=require', 'sslmode=no-verify'),
  });
  await client.connect();
  try {
    const result = await client.query(sql);
    console.log(`✔ 챌린지 시드 완료 — ${result.rowCount ?? 0}건 추가`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
