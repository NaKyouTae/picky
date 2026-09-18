import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL 환경변수가 필요합니다.');
    }

    super({
      // Prisma 7 은 드라이버 어댑터로 연결합니다 (Supabase transaction pooler 사용)
      adapter: new PrismaPg({ connectionString }),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (error) {
      // 운영에서는 즉시 실패, 로컬에서는 DB 없이도 서버가 기동되도록 경고만 남깁니다.
      if (process.env.NODE_ENV === 'production') throw error;
      this.logger.warn(`Prisma 연결 실패 (DATABASE_URL 확인 필요): ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
