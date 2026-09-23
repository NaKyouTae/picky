import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, randomBytes, sign as signRaw } from 'node:crypto';

const AUTHORIZE_ENDPOINT = 'https://appleid.apple.com/auth/authorize';
const TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token';
const REVOKE_ENDPOINT = 'https://appleid.apple.com/auth/revoke';
const ISSUER = 'https://appleid.apple.com';

/** 애플이 client_secret 에 허용하는 최대 수명은 6개월. 짧게 끊어 쓴다. */
const CLIENT_SECRET_TTL_SEC = 10 * 60;

/** 인가 URL 과 함께 프론트가 쿠키에 보관해야 할 일회용 값 */
export interface AppleAuthorizeRequest {
  url: string;
  /** CSRF 방어 — 콜백으로 돌아온 state 와 대조한다 */
  state: string;
}

/** 로그인에 필요한 프로필 — 애플이 주는 것은 이게 전부다 */
export interface AppleProfile {
  /** 애플 사용자 식별자 — Account.providerId. 우리 팀 안에서만 유효한 값이다 */
  sub: string;
  /** 비공개 이메일 릴레이를 쓰면 @privaterelay.appleid.com 주소가 온다 */
  email: string | null;
  /** 최초 1회만 받을 수 있다 — 없으면 호출부가 대체 이름을 쓴다 */
  name: string | null;
  /**
   * 갱신 토큰 — 탈퇴할 때 연결 해제(revoke)에만 쓴다.
   * 애플은 계정 삭제 시 토큰 폐기를 요구하므로(App Store 심사) 암호화해 보관한다.
   */
  refreshToken: string | null;
}

/**
 * Sign in with Apple (OAuth 2.0 Authorization Code + OIDC).
 *
 * 카카오·네이버와 다른 점이 많다:
 *
 * 1. **client_secret 이 고정 문자열이 아니다.** 애플이 발급한 .p8 개인키로 서명한
 *    단명 JWT(ES256)를 매 요청 만들어 보낸다.
 * 2. **프로필 API 가 없다.** 사용자 정보는 토큰 응답의 id_token 안에만 있다.
 * 3. **이름은 최초 1회만 준다.** 그것도 id_token 이 아니라 콜백 폼의 `user` 필드로 온다.
 *    두 번째 로그인부터는 아무도 이름을 알려주지 않으므로 우리 DB 가 원본이다.
 * 4. **전화번호를 주지 않는다.** 이 서비스는 연락처로 회원을 묶는데(auth.service.ts)
 *    애플 로그인은 묶을 근거가 없어 늘 별도 회원이 된다.
 * 5. **콜백이 POST 다.** scope 를 요청하면 response_mode=form_post 가 강제된다.
 */
@Injectable()
export class AppleOAuthService {
  private readonly logger = new Logger(AppleOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /** Apple Developer > Identifiers > Services IDs 의 식별자 (웹 로그인의 client_id) */
  private get clientId() {
    return this.config.getOrThrow<string>('APPLE_CLIENT_ID');
  }

  /** Apple Developer 계정 오른쪽 위 10자리 팀 ID */
  private get teamId() {
    return this.config.getOrThrow<string>('APPLE_TEAM_ID');
  }

  /** Keys 에서 만든 'Sign in with Apple' 키의 Key ID */
  private get keyId() {
    return this.config.getOrThrow<string>('APPLE_KEY_ID');
  }

  /**
   * .p8 개인키 본문(PEM). 환경변수 한 줄에 넣기 위해 줄바꿈을 `\n` 으로 이스케이프해
   * 두는 경우가 많아 되돌려 준다.
   */
  private get privateKey() {
    return this.config.getOrThrow<string>('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  }

  /** Services ID 의 Return URL 과 문자 단위로 같아야 한다 */
  private get redirectUri() {
    return this.config.getOrThrow<string>('APPLE_REDIRECT_URI');
  }

  /** 로그인 시작 — 인가 URL 과 일회용 state 를 만든다. */
  createAuthorizeRequest(): AppleAuthorizeRequest {
    const state = randomBytes(32).toString('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: 'name email',
      // scope 를 요청하면 애플이 form_post 를 강제한다. 명시해 두어야 동작이 분명하다.
      response_mode: 'form_post',
    });

    return { url: `${AUTHORIZE_ENDPOINT}?${params.toString()}`, state };
  }

  /**
   * 콜백으로 받은 code 를 프로필로 교환한다.
   *
   * @param code  애플이 준 인가 코드 (5분 만료, 1회용)
   * @param name  최초 인가 때만 콜백 폼의 `user` 필드로 오는 이름. 그 외에는 null.
   */
  async exchangeCodeForProfile(code: string, name: string | null): Promise<AppleProfile> {
    const { idToken, refreshToken } = await this.requestToken(code);
    const claims = this.readIdToken(idToken);

    return {
      sub: claims.sub.slice(0, 255),
      email: claims.email?.trim() || null,
      name: name?.trim() || null,
      refreshToken,
    };
  }

  /**
   * 탈퇴 시 연결 해제.
   *
   * 애플은 계정 삭제를 지원하는 앱이 **발급받은 토큰을 폐기할 것**을 요구한다.
   * 네이버와 마찬가지로 **실패해도 throw 하지 않는다** — 탈퇴는 사용자의 권리라
   * 외부 API 장애로 막으면 안 된다. 끊지 못하면 false 를 돌려주고 호출부가
   * [설정 > Apple 계정 > 로그인 및 보안 > Apple로 로그인]에서 직접 끊도록 안내한다.
   *
   * @param refreshToken 로그인 때 보관해 둔 갱신 토큰 (복호화된 평문)
   */
  async unlink(refreshToken: string | null): Promise<boolean> {
    if (!refreshToken) {
      this.logger.warn('보관된 애플 갱신 토큰이 없어 연결 해제를 건너뜁니다.');
      return false;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.createClientSecret(),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    });

    const res = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).catch((error: unknown) => {
      this.logger.warn(`애플 연결 해제 호출 실패: ${String(error)}`);
      return null;
    });

    if (!res) return false;
    if (!res.ok) {
      this.logger.warn(`애플 연결 해제 응답 (${res.status}): ${await res.text()}`);
      return false;
    }
    // 애플은 성공하면 본문 없는 200 을 준다.
    return true;
  }

  private async requestToken(
    code: string,
  ): Promise<{ idToken: string; refreshToken: string | null }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.createClientSecret(),
      redirect_uri: this.redirectUri,
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).catch((error: unknown) => {
      this.logger.error(`애플 토큰 엔드포인트 호출 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('애플 인증 서버에 연결할 수 없습니다.');
    }
    if (!res.ok) {
      this.logger.warn(`애플 토큰 교환 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('애플 로그인에 실패했습니다. 다시 시도해 주세요.');
    }

    const data = (await res.json()) as AppleTokenResponse;
    if (!data.id_token) {
      this.logger.warn(`애플 응답에 id_token 이 없습니다 (error=${data.error ?? '없음'}).`);
      throw new UnauthorizedException('애플 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    if (!data.refresh_token) {
      // 로그인은 되지만 탈퇴할 때 토큰을 폐기하지 못한다 — 그때 직접 해제 안내로 떨어진다.
      this.logger.warn('애플 응답에 refresh_token 이 없습니다 — 탈퇴 시 연결 해제 불가.');
    }
    return { idToken: data.id_token, refreshToken: data.refresh_token ?? null };
  }

  /**
   * client_secret — 애플이 준 .p8 키로 서명한 ES256 JWT.
   *
   * 매 요청 새로 만든다. 캐시해 둘 만큼 비싼 연산이 아니고, 수명이 짧을수록 안전하다.
   */
  private createClientSecret(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: this.keyId, typ: 'JWT' };
    const payload = {
      iss: this.teamId,
      iat: now,
      exp: now + CLIENT_SECRET_TTL_SEC,
      aud: ISSUER,
      sub: this.clientId,
    };

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

    // JWS 는 서명을 R||S 로 이어 붙인 형태로 요구한다. Node 기본값인 DER 로 서명하면
    // 애플이 invalid_client 로 거절한다 — dsaEncoding 을 반드시 ieee-p1363 으로 둘 것.
    const signature = signRaw(null, Buffer.from(signingInput), {
      key: createPrivateKey(this.privateKey),
      dsaEncoding: 'ieee-p1363',
    });

    return `${signingInput}.${signature.toString('base64url')}`;
  }

  /**
   * id_token 에서 사용자 정보를 읽는다.
   *
   * **서명은 검증하지 않는다.** 이 토큰은 우리 서버가 애플 토큰 엔드포인트에 TLS 로 직접
   * 요청해 받은 응답이고, 브라우저가 건네준 id_token 은 절대 받지 않는다. 이 경우 서명 검증을
   * 생략해도 된다고 OIDC Core 3.1.3.7 이 명시한다(항목 6). 카카오·네이버 프로필을 HTTPS
   * 응답만 믿고 쓰는 것과 같은 신뢰 모델이다.
   *
   * 대신 발급자·수신자·만료는 확인한다 — 잘못된 설정(다른 Services ID 등)을 조용히
   * 넘기지 않기 위해서다.
   */
  private readIdToken(idToken: string): AppleIdTokenClaims {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('애플 계정 정보를 불러올 수 없습니다.');
    }

    let claims: AppleIdTokenClaims;
    try {
      claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString()) as AppleIdTokenClaims;
    } catch {
      throw new UnauthorizedException('애플 계정 정보를 불러올 수 없습니다.');
    }

    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== ISSUER || !audience.includes(this.clientId)) {
      this.logger.warn(`애플 id_token 의 iss/aud 가 맞지 않습니다 (aud=${audience.join(',')}).`);
      throw new UnauthorizedException('애플 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('애플 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    if (!claims.sub) {
      throw new UnauthorizedException('애플 계정 식별자를 받지 못했습니다.');
    }

    return claims;
  }
}

interface AppleTokenResponse {
  id_token?: string;
  /** 탈퇴 시 폐기용으로 보관한다 */
  refresh_token?: string;
  error?: string;
}

/** id_token 의 클레임 중 우리가 쓰는 것 */
interface AppleIdTokenClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  /** 애플 사용자 식별자 */
  sub: string;
  /** email scope 에 동의했을 때만 온다. 비공개 릴레이 주소일 수 있다 */
  email?: string;
}

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}
