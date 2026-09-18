import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

const AUTHORIZE_ENDPOINT = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token';
const USER_ME_ENDPOINT = 'https://kapi.kakao.com/v2/user/me';
const VALID_ISSUER = 'https://kauth.kakao.com';

/** 인가 URL 과 함께 프론트가 쿠키에 보관해야 할 일회용 값들 */
export interface KakaoAuthorizeRequest {
  url: string;
  /** CSRF 방어 — 콜백 쿼리의 state 와 대조 */
  state: string;
  /** 리플레이 방어 — id_token 의 nonce 와 대조 */
  nonce: string;
  /** PKCE — 토큰 교환 시 code_verifier 로 되돌려 보냄 */
  codeVerifier: string;
}

/** 로그인에 필요한 최소 프로필 */
export interface KakaoProfile {
  /** 카카오 회원번호 — Account.providerId */
  sub: string;
  email: string;
  name: string;
}

/**
 * 카카오 로그인 (OIDC Authorization Code + PKCE).
 *
 * 신원 확인은 id_token(iss/aud/exp/nonce)으로 하고,
 * 이메일은 id_token 에 검증 플래그가 없으므로 `/v2/user/me` 로 한 번 더 확인한다.
 * REST API 키와 Client Secret 은 서버에만 둔다.
 */
@Injectable()
export class KakaoOAuthService {
  private readonly logger = new Logger(KakaoOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /** 카카오 developers > 앱 키 > REST API 키 (id_token 의 aud 와 같은 값) */
  private get clientId() {
    return this.config.getOrThrow<string>('KAKAO_REST_API_KEY');
  }

  /** [카카오 로그인 > 보안]에서 '사용함'으로 켠 경우에만 값이 있다 */
  private get clientSecret() {
    return this.config.get<string>('KAKAO_CLIENT_SECRET')?.trim() || null;
  }

  /** 카카오 콘솔에 등록한 값과 문자 단위로 같아야 한다 (토큰 교환 때도 그대로 전송) */
  private get redirectUri() {
    return this.config.getOrThrow<string>('KAKAO_REDIRECT_URI');
  }

  /** 로그인 시작 — 인가 URL 과 일회용 값(state/nonce/codeVerifier)을 만든다. */
  createAuthorizeRequest(): KakaoAuthorizeRequest {
    const state = randomUrlSafe();
    const nonce = randomUrlSafe();
    const codeVerifier = randomUrlSafe(64);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      // openid 가 있어야 id_token 이 내려온다. 이메일·닉네임은 카카오 콘솔의
      // [동의항목]에서 먼저 사용 설정돼 있어야 요청할 수 있다.
      scope: 'openid account_email profile_nickname',
      state,
      nonce,
      code_challenge: base64UrlEncode(createHash('sha256').update(codeVerifier).digest()),
      code_challenge_method: 'S256',
    });

    return { url: `${AUTHORIZE_ENDPOINT}?${params.toString()}`, state, nonce, codeVerifier };
  }

  /** 콜백으로 받은 code 를 프로필로 교환한다. */
  async exchangeCodeForProfile(
    code: string,
    nonce: string,
    codeVerifier: string,
  ): Promise<KakaoProfile> {
    const token = await this.requestToken(code, codeVerifier);
    const { sub, nickname } = this.parseIdToken(token.idToken, nonce);
    const account = await this.requestAccount(token.accessToken);

    return { sub, email: account.email, name: account.nickname || nickname || '카카오 사용자' };
  }

  private async requestToken(
    code: string,
    codeVerifier: string,
  ): Promise<{ accessToken: string; idToken: string }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code,
      code_verifier: codeVerifier,
    });
    const { clientSecret } = this;
    if (clientSecret) body.set('client_secret', clientSecret);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    }).catch((error: unknown) => {
      this.logger.error(`카카오 토큰 엔드포인트 호출 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('카카오 인증 서버에 연결할 수 없습니다.');
    }

    if (!res.ok) {
      // invalid_grant(코드 재사용/만료), KOE006(Redirect URI 불일치) 등은 로그로만 남긴다.
      this.logger.warn(`카카오 토큰 교환 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('카카오 로그인에 실패했습니다. 다시 시도해 주세요.');
    }

    const data = (await res.json()) as { access_token?: string; id_token?: string };
    if (!data.access_token || !data.id_token) {
      // id_token 이 없으면 콘솔에서 OpenID Connect 가 꺼져 있는 경우가 대부분이다.
      this.logger.warn('카카오 응답에 access_token/id_token 이 없습니다 (OIDC 활성화 확인).');
      throw new UnauthorizedException('카카오 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    return { accessToken: data.access_token, idToken: data.id_token };
  }

  /**
   * id_token(JWT) 의 클레임을 검증한다.
   * HTTPS 로 카카오 토큰 엔드포인트에서 직접 받은 토큰이라 서명 검증은 생략하고
   * iss/aud/exp/nonce 를 확인한다.
   */
  private parseIdToken(idToken: string, nonce: string): { sub: string; nickname: string } {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('카카오 id_token 형식이 올바르지 않습니다.');
    }

    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      throw new UnauthorizedException('카카오 id_token 을 해석할 수 없습니다.');
    }

    const iss = String(claims.iss ?? '');
    const exp = Number(claims.exp ?? 0);
    const sub = String(claims.sub ?? '');
    // aud 는 문자열 또는 문자열 배열로 올 수 있다.
    const aud = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud ?? '')];

    if (iss !== VALID_ISSUER || !aud.includes(this.clientId)) {
      throw new UnauthorizedException('카카오 id_token 의 발급자가 올바르지 않습니다.');
    }
    if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('카카오 id_token 이 만료되었습니다.');
    }
    if (claims.nonce !== nonce) {
      throw new UnauthorizedException('로그인 요청이 일치하지 않습니다. 다시 시도해 주세요.');
    }
    if (!sub) {
      throw new UnauthorizedException('카카오 계정 식별자를 받지 못했습니다.');
    }

    return { sub, nickname: String(claims.nickname ?? '').trim() };
  }

  /**
   * 이메일·닉네임 조회.
   * User.email 은 필수·unique 이므로 검증되지 않은 이메일은 받지 않는다
   * (미인증 이메일로 계정을 만들면 다른 제공자 계정의 소유권을 가로챌 수 있다).
   */
  private async requestAccount(accessToken: string): Promise<{ email: string; nickname: string }> {
    const res = await fetch(USER_ME_ENDPOINT, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch((error: unknown) => {
      this.logger.error(`카카오 사용자 조회 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('카카오 인증 서버에 연결할 수 없습니다.');
    }
    if (!res.ok) {
      this.logger.warn(`카카오 사용자 조회 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('카카오 계정 정보를 불러올 수 없습니다.');
    }

    const data = (await res.json()) as {
      kakao_account?: {
        email?: string;
        is_email_valid?: boolean;
        is_email_verified?: boolean;
        profile?: { nickname?: string };
      };
    };

    const account = data.kakao_account;
    const email = account?.email?.trim() ?? '';

    if (!email) {
      // 이메일이 선택 동의인데 사용자가 거부했거나, 콘솔 동의항목이 꺼져 있는 경우.
      throw new UnauthorizedException(
        '이메일 제공에 동의해야 로그인할 수 있습니다. 다시 시도해 주세요.',
      );
    }
    if (account?.is_email_valid === false || account?.is_email_verified === false) {
      throw new UnauthorizedException('이메일이 확인된 카카오 계정만 로그인할 수 있습니다.');
    }

    return { email, nickname: String(account?.profile?.nickname ?? '').trim() };
  }
}

/** URL 에 그대로 넣을 수 있는 난수 문자열 */
function randomUrlSafe(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}
