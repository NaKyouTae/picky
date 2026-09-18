import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { AdminJwtPayload } from '../../admin/auth/admin-auth.service';

export type AdminRequest = Request & { admin?: AdminJwtPayload };

/**
 * 관리자 전용 가드.
 * Authorization: Bearer <token> 의 토큰이
 *  1) 로그인으로 발급된 관리자 JWT 이거나
 *  2) 서버 ADMIN_TOKEN 정적 토큰(서버 간 호출용)
 * 이면 통과시킨다.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    const staticToken = this.config.get<string>('ADMIN_TOKEN');
    if (staticToken && constantTimeEqual(token, staticToken)) {
      req.admin = { sub: 'service', username: 'service', role: 'ADMIN' };
      return true;
    }

    try {
      const payload = this.jwt.verify<AdminJwtPayload>(token);
      if (payload.role !== 'ADMIN') {
        throw new UnauthorizedException('관리자 권한이 없습니다.');
      }
      req.admin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }
}

function constantTimeEqual(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
