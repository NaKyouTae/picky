import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '서버 상태 확인' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('db')
  @ApiOperation({ summary: 'DB 연결 확인' })
  async checkDb() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'connected' };
  }
}
