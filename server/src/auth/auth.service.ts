import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderType, UserStatus } from '../generated/prisma/enums';
import { GoogleOAuthService } from './google-oauth.service';
import { KakaoOAuthService } from './kakao-oauth.service';

/** 제공자에 관계없이 로그인에 필요한 최소 프로필 */
interface SnsProfile {
  providerType: ProviderType;
  /** 제공자가 발급한 고유 회원번호 */
  providerId: string;
  email: string;
  name: string;
}

export interface UserJwtPayload {
  sub: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthSession {
  accessToken: string;
  /** epoch seconds — 프론트가 쿠키 만료를 JWT 와 맞추는 데 사용 */
  expiresAt: number;
  user: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' };
}

const USER_FIELDS = { id: true, email: true, name: true, role: true, status: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly google: GoogleOAuthService,
    private readonly kakao: KakaoOAuthService,
  ) {}

  /** 로그인 시작 — 프론트는 url 로 이동시키고 나머지 값은 httpOnly 쿠키에 보관한다. */
  createGoogleAuthorizeRequest() {
    return this.google.createAuthorizeRequest();
  }

  createKakaoAuthorizeRequest() {
    return this.kakao.createAuthorizeRequest();
  }

  /** 구글 콜백 — code 를 프로필로 교환하고 세션(JWT)을 발급한다. */
  async loginWithGoogle(code: string, nonce: string, codeVerifier: string): Promise<AuthSession> {
    const { sub, email, name } = await this.google.exchangeCodeForProfile(
      code,
      nonce,
      codeVerifier,
    );
    return this.login({ providerType: ProviderType.GOOGLE, providerId: sub, email, name });
  }

  /** 카카오 콜백 — code 를 프로필로 교환하고 세션(JWT)을 발급한다. */
  async loginWithKakao(code: string, nonce: string, codeVerifier: string): Promise<AuthSession> {
    const { sub, email, name } = await this.kakao.exchangeCodeForProfile(code, nonce, codeVerifier);
    return this.login({ providerType: ProviderType.KAKAO, providerId: sub, email, name });
  }

  private async login(profile: SnsProfile): Promise<AuthSession> {
    const user = await this.findOrCreateUser(profile);

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('이용이 제한된 계정입니다.');
    }

    return this.issueSession(user);
  }

  /** 세션 확인 — 토큰이 유효해도 그 사이 정지·탈퇴됐을 수 있으므로 DB 상태까지 본다. */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_FIELDS,
    });

    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  /**
   * (제공자, 회원번호) 로 기존 연결을 먼저 찾고,
   * 없으면 같은 이메일의 유저에 계정을 연결하거나(다른 제공자로 먼저 가입한 경우) 새로 만든다.
   */
  private async findOrCreateUser({ providerType, providerId, email, name }: SnsProfile) {
    const linked = await this.prisma.account.findUnique({
      where: { providerType_providerId: { providerType, providerId } },
      select: { user: { select: USER_FIELDS } },
    });
    if (linked) return linked.user;

    // User.email 은 unique — 다른 제공자로 이미 가입한 이메일이면 그 유저에 연결한다.
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      const account = await this.prisma.account.create({
        data: { userId: existing.id, providerType, providerId },
        select: { user: { select: USER_FIELDS } },
      });
      return account.user;
    }

    return this.prisma.user.create({
      data: {
        email,
        name,
        accounts: { create: { providerType, providerId } },
      },
      select: USER_FIELDS,
    });
  }

  private issueSession(user: {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'ADMIN';
  }): AuthSession {
    const payload: UserJwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      accessToken,
      expiresAt: exp,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
