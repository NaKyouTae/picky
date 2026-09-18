import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import type { AdminLoginDto } from './dto/admin-login.dto';

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: 'ADMIN';
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * 관리자 계정은 DB 가 아니라 서버 환경변수(ADMIN_USERNAME / ADMIN_PASSWORD)로 관리한다. (MVP)
   * 일치하면 JWT 를 발급하고, 어드민 프론트는 이를 httpOnly 쿠키로 보관한다.
   */
  login(dto: AdminLoginDto) {
    const username = this.config.get<string>('ADMIN_USERNAME');
    const password = this.config.get<string>('ADMIN_PASSWORD');

    if (!username || !password) {
      throw new InternalServerErrorException('관리자 계정이 설정되지 않았습니다.');
    }

    // 아이디/비밀번호 중 무엇이 틀렸는지 노출하지 않고, 비교 시간도 값에 따라 달라지지 않게 한다.
    const ok = safeEqual(dto.username, username) && safeEqual(dto.password, password);
    if (!ok) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    const payload: AdminJwtPayload = { sub: username, username, role: 'ADMIN' };
    const accessToken = this.jwt.sign(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      accessToken,
      /** epoch seconds — 어드민에서 쿠키 만료에 사용 */
      expiresAt: exp,
      admin: { username, role: 'ADMIN' as const },
    };
  }
}

/** 길이가 달라도 예외 없이 false 를 반환하는 상수 시간 비교 */
function safeEqual(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // 길이만 보고 빠르게 빠져나가지 않도록 더미 비교를 수행한다.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
