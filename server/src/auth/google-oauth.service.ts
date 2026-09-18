import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const VALID_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** 인가 URL 과 함께 프론트가 쿠키에 보관해야 할 일회용 값들 */
export interface GoogleAuthorizeRequest {
  url: string;
  /** CSRF 방어 — 콜백 쿼리의 state 와 대조 */
  state: string;
  /** 리플레이 방어 — id_token 의 nonce 와 대조 */
  nonce: string;
  /** PKCE — 토큰 교환 시 code_verifier 로 되돌려 보냄 */
  codeVerifier: string;
}

/** id_token 에서 뽑아 쓰는 클레임 */
export interface GoogleProfile {
  /** 구글 고유 회원번호 — Account.providerId */
  sub: string;
  email: string;
  name: string;
}

/**
 * 구글 OAuth 2.0 (Authorization Code + PKCE).
 * 클라이언트 ID/시크릿은 서버에만 두고, 프론트는 여기서 만든 URL 로 브라우저를 보내기만 한다.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  private get clientId() {
    return this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  private get clientSecret() {
    return this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
  }

  /** 구글 콘솔에 등록한 값과 문자 단위로 같아야 한다 (토큰 교환 때도 그대로 전송) */
  private get redirectUri() {
    return this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');
  }

  /** 로그인 시작 — 인가 URL 과 일회용 값(state/nonce/codeVerifier)을 만든다. */
  createAuthorizeRequest(): GoogleAuthorizeRequest {
    const state = randomUrlSafe();
    const nonce = randomUrlSafe();
    const codeVerifier = randomUrlSafe(64);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      // 비민감 범위 3개만 — 구글 심사 없이 게시 가능
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: base64UrlEncode(createHash('sha256').update(codeVerifier).digest()),
      code_challenge_method: 'S256',
      // 리프레시 토큰을 보관하지 않는다 (로그인 용도만)
      access_type: 'online',
      // 이미 로그인된 구글 계정이 있어도 계정 선택 화면을 띄운다
      prompt: 'select_account',
    });

    return { url: `${AUTHORIZE_ENDPOINT}?${params.toString()}`, state, nonce, codeVerifier };
  }

  /** 콜백으로 받은 code 를 프로필로 교환한다. */
  async exchangeCodeForProfile(
    code: string,
    nonce: string,
    codeVerifier: string,
  ): Promise<GoogleProfile> {
    const idToken = await this.requestIdToken(code, codeVerifier);
    return this.parseIdToken(idToken, nonce);
  }

  private async requestIdToken(code: string, codeVerifier: string): Promise<string> {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    }).catch((error: unknown) => {
      this.logger.error(`구글 토큰 엔드포인트 호출 실패: ${String(error)}`);
      return null;
    });

    if (!res) {
      throw new ServiceUnavailableException('구글 인증 서버에 연결할 수 없습니다.');
    }

    if (!res.ok) {
      // invalid_grant(코드 재사용/만료), redirect_uri_mismatch 등 원인은 로그로만 남긴다.
      this.logger.warn(`구글 토큰 교환 실패 (${res.status}): ${await res.text()}`);
      throw new UnauthorizedException('구글 로그인에 실패했습니다. 다시 시도해 주세요.');
    }

    const data = (await res.json()) as { id_token?: string };
    if (!data.id_token) {
      throw new UnauthorizedException('구글 응답에 id_token 이 없습니다.');
    }
    return data.id_token;
  }

  /**
   * id_token(JWT) 의 클레임을 검증한다.
   * 이 토큰은 클라이언트를 거치지 않고 HTTPS 로 구글 토큰 엔드포인트에서 직접 받았으므로
   * 구글 문서 기준 서명 검증은 생략할 수 있다. 대신 iss/aud/exp/nonce 는 반드시 확인한다.
   */
  private parseIdToken(idToken: string, nonce: string): GoogleProfile {
    const segments = idToken.split('.');
    if (segments.length !== 3) {
      throw new UnauthorizedException('구글 id_token 형식이 올바르지 않습니다.');
    }

    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      throw new UnauthorizedException('구글 id_token 을 해석할 수 없습니다.');
    }

    const iss = String(claims.iss ?? '');
    const aud = String(claims.aud ?? '');
    const exp = Number(claims.exp ?? 0);
    const sub = String(claims.sub ?? '');
    const email = String(claims.email ?? '');

    if (!VALID_ISSUERS.includes(iss) || aud !== this.clientId) {
      throw new UnauthorizedException('구글 id_token 의 발급자가 올바르지 않습니다.');
    }
    if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) {
      throw new UnauthorizedException('구글 id_token 이 만료되었습니다.');
    }
    if (claims.nonce !== nonce) {
      throw new UnauthorizedException('로그인 요청이 일치하지 않습니다. 다시 시도해 주세요.');
    }
    if (!sub) {
      throw new UnauthorizedException('구글 계정 식별자를 받지 못했습니다.');
    }
    // User.email 은 필수·unique — 미인증 이메일로 계정을 만들면 소유권 도용이 가능하다.
    if (!email || claims.email_verified !== true) {
      throw new UnauthorizedException('이메일이 확인된 구글 계정만 로그인할 수 있습니다.');
    }

    return { sub, email, name: String(claims.name ?? '').trim() || email.split('@')[0] };
  }
}

/** URL 에 그대로 넣을 수 있는 난수 문자열 */
function randomUrlSafe(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}
