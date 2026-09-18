import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserJwtPayload } from '../../auth/auth.service';

export type AuthedRequest = Request & { user?: UserJwtPayload };

/** 사용자 JWT 가드 — Authorization: Bearer <token> (프론트가 httpOnly 쿠키에서 꺼내 붙인다) */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    try {
      req.user = this.jwt.verify<UserJwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다.');
    }
  }
}
