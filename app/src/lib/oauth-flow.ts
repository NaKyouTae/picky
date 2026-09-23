import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from './api';
import {
  HOME_PATH,
  LAST_PROVIDER_COOKIE,
  LAST_PROVIDER_MAX_AGE,
  LOGIN_PATH,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
} from './constants';

/** SNS 로그인 제공자 — 서버 라우트(`/auth/{provider}/…`) 경로와 같은 문자열 */
export type OAuthProvider = 'kakao' | 'naver';

/**
 * 제공자마다 인가 코드를 지키는 방법이 다르다.
 *
 * - 카카오: PKCE — 인가 때 code_challenge 를 보내고 교환 때 code_verifier 로 증명한다.
 * - 네이버: PKCE 미지원 — state 를 쿠키와 대조하고, 교환 때 네이버에 다시 보내 확인받는다.
 *
 * 서버 DTO 가 whitelist 검증(`forbidNonWhitelisted`)을 하므로 본문에 필요한 값만 정확히 보낸다.
 */
const USES_PKCE: Record<OAuthProvider, boolean> = { kakao: true, naver: false };

type AuthorizeResult = { url: string; state: string; codeVerifier?: string };

type LoginResult = {
  accessToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string | null;
    name: string;
    phone: string | null;
    role: 'USER' | 'ADMIN';
  };
};

const ONE_TIME_COOKIES = [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE] as const;

/** 일회용 쿠키는 해당 제공자의 로그인 경로에서만 전송된다 */
const cookiePath = (provider: OAuthProvider) => `/auth/${provider}`;

/**
 * 로그인 시작 핸들러.
 * 인가 URL 은 NestJS 가 만든다 (클라이언트 ID/시크릿을 프론트에 두지 않기 위해).
 * 여기서는 돌려받은 일회용 값만 httpOnly 쿠키에 담고 브라우저를 제공자로 보낸다.
 */
export function createOAuthStartHandler(provider: OAuthProvider) {
  return async function GET(req: NextRequest) {
    const res = await fetch(`${API_BASE_URL}/auth/${provider}/authorize`, {
      cache: 'no-store',
    }).catch(() => null);

    if (!res?.ok) {
      return NextResponse.redirect(new URL(`${HOME_PATH}?error=${provider}_unavailable`, req.url));
    }

    const { url, state, codeVerifier } = (await res.json()) as AuthorizeResult;
    const response = NextResponse.redirect(url);

    const oneTimeValues: [name: string, value: string][] = [[OAUTH_STATE_COOKIE, state]];
    // PKCE 를 쓰지 않는 제공자는 code_verifier 가 없다.
    if (codeVerifier) oneTimeValues.push([OAUTH_VERIFIER_COOKIE, codeVerifier]);

    for (const [name, value] of oneTimeValues) {
      response.cookies.set({
        name,
        value,
        httpOnly: true,
        // 제공자에서 돌아오는 top-level 리디렉션에도 쿠키가 실려야 하므로 lax
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: cookiePath(provider),
        maxAge: OAUTH_COOKIE_MAX_AGE,
      });
    }

    return response;
  };
}

/**
 * 제공자 리디렉션 착지점 (각 콘솔에 등록한 Redirect URI).
 * state 를 쿠키와 대조해 CSRF 를 막고, code 는 NestJS 에서 세션으로 교환한다.
 * 토큰은 브라우저 JS 가 만지지 않도록 httpOnly 쿠키로만 보관한다.
 */
export function createOAuthCallbackHandler(provider: OAuthProvider) {
  return async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const store = req.cookies;

    const code = params.get('code');
    const state = params.get('state');
    const codeVerifier = store.get(OAUTH_VERIFIER_COOKIE)?.value;
    const savedState = store.get(OAUTH_STATE_COOKIE)?.value;

    // 사용자가 동의 화면에서 취소하면 error=access_denied 로 돌아온다.
    if (params.get('error')) {
      return finish(req, provider, 'cancelled');
    }
    const usesPkce = USES_PKCE[provider];
    if (!code || !state || !savedState || state !== savedState) {
      return finish(req, provider, 'invalid_state');
    }
    if (usesPkce && !codeVerifier) {
      return finish(req, provider, 'invalid_state');
    }

    const res = await fetch(`${API_BASE_URL}/auth/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usesPkce ? { code, codeVerifier } : { code, state }),
      cache: 'no-store',
    }).catch(() => null);

    if (!res?.ok) {
      return finish(req, provider, 'login_failed');
    }

    const data = (await res.json()) as LoginResult;
    const response = finish(req, provider, null, HOME_PATH);

    response.cookies.set({
      name: SESSION_COOKIE,
      value: data.accessToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // JWT 만료와 쿠키 만료를 일치시킨다.
      expires: new Date(data.expiresAt * 1000),
    });

    // 다음 로그인 때 '최근 로그인' 말풍선을 어디에 띄울지 — 성공했을 때만 기록한다.
    response.cookies.set({
      name: LAST_PROVIDER_COOKIE,
      value: provider,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: LAST_PROVIDER_MAX_AGE,
    });

    return response;
  };
}

/**
 * 일회용 OAuth 쿠키를 정리하고 돌려보낸다.
 * 성공하면 홈으로, 실패하면 다시 시도할 수 있게 로그인 화면으로 보낸다.
 */
function finish(
  req: NextRequest,
  provider: OAuthProvider,
  error: string | null,
  /** 성공했을 때 보낼 곳 — 가입 직후에는 동의 화면이다 */
  destination = HOME_PATH,
) {
  const url = new URL(error ? LOGIN_PATH : destination, req.url);
  if (error) url.searchParams.set('error', error);

  const response = NextResponse.redirect(url);
  for (const name of ONE_TIME_COOKIES) {
    // 설정할 때와 path 가 같아야 실제로 삭제된다.
    response.cookies.set({ name, value: '', path: cookiePath(provider), maxAge: 0 });
  }
  return response;
}
