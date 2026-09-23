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
export type OAuthProvider = 'kakao' | 'naver' | 'apple';

/**
 * 제공자마다 인가 코드를 지키는 방법이 다르다.
 *
 * - 카카오: PKCE — 인가 때 code_challenge 를 보내고 교환 때 code_verifier 로 증명한다.
 * - 네이버: PKCE 미지원 — state 를 쿠키와 대조하고, 교환 때 네이버에 다시 보내 확인받는다.
 *
 * 서버 DTO 가 whitelist 검증(`forbidNonWhitelisted`)을 하므로 본문에 필요한 값만 정확히 보낸다.
 */
const USES_PKCE: Record<OAuthProvider, boolean> = { kakao: true, naver: false, apple: false };

/**
 * 제공자가 우리에게 돌아오는 방식.
 *
 * 애플은 scope(name·email)를 요청하면 `response_mode=form_post` 가 강제되어 **다른 사이트에서
 * 우리 쪽으로 POST** 한다. SameSite=Lax 쿠키는 이 요청에 실리지 않으므로 state 쿠키를 잃는다.
 * 그래서 애플만 None 으로 둔다 (None 은 Secure 가 필수라 개발 환경에서도 secure 를 켠다 —
 * 애플은 어차피 http/localhost 를 Return URL 로 받아주지 않아 로컬에서는 테스트할 수 없다).
 */
const CROSS_SITE_CALLBACK: Record<OAuthProvider, boolean> = {
  kakao: false,
  naver: false,
  apple: true,
};

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

/** 일회용 쿠키의 전송 규칙 — 제공자가 돌아오는 방식에 따라 갈린다 */
function oneTimeCookieOptions(provider: OAuthProvider) {
  const crossSite = CROSS_SITE_CALLBACK[provider];
  return {
    httpOnly: true,
    // 제공자에서 돌아오는 top-level 리디렉션에도 쿠키가 실려야 하므로 lax,
    // 크로스사이트 POST 로 돌아오는 제공자(애플)는 none + secure.
    sameSite: crossSite ? ('none' as const) : ('lax' as const),
    secure: crossSite || process.env.NODE_ENV === 'production',
    path: cookiePath(provider),
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}

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

    const cookieOptions = oneTimeCookieOptions(provider);
    for (const [name, value] of oneTimeValues) {
      response.cookies.set({ name, value, ...cookieOptions });
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

    // 사용자가 동의 화면에서 취소하면 error=access_denied 로 돌아온다.
    if (params.get('error')) {
      return finish(req, provider, 'cancelled');
    }

    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state || !matchesSavedState(req, state)) {
      return finish(req, provider, 'invalid_state');
    }

    if (USES_PKCE[provider]) {
      const codeVerifier = store.get(OAUTH_VERIFIER_COOKIE)?.value;
      if (!codeVerifier) return finish(req, provider, 'invalid_state');
      return exchange(req, provider, { code, codeVerifier });
    }

    return exchange(req, provider, { code, state });
  };
}

/**
 * 애플 전용 착지점 — **POST** 다.
 *
 * scope(name·email)를 요청하면 애플이 `response_mode=form_post` 로 강제하기 때문에,
 * 쿼리가 아니라 폼 본문으로 돌아온다. 그래서 GET 핸들러를 그대로 쓸 수 없다.
 *
 * 폼의 `user` 필드에는 **최초 인가 때 단 한 번만** 이름이 실려 온다. 여기서 받아 두지 않으면
 * 이후로는 어디에서도 이름을 얻을 수 없다.
 */
export function createAppleCallbackHandler() {
  const provider: OAuthProvider = 'apple';

  return async function POST(req: NextRequest) {
    const form = await req.formData().catch(() => null);
    if (!form) return finish(req, provider, 'login_failed');

    const field = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value : null;
    };

    // 사용자가 애플 동의 화면에서 취소하면 error=user_cancelled_authorize 로 돌아온다.
    if (field('error')) return finish(req, provider, 'cancelled');

    const code = field('code');
    if (!code || !matchesSavedState(req, field('state'))) {
      return finish(req, provider, 'invalid_state');
    }

    const name = parseAppleUserName(field('user'));
    // 서버 DTO 가 whitelist 검증을 하므로 이름이 없으면 키 자체를 보내지 않는다.
    return exchange(req, provider, name ? { code, name } : { code });
  };
}

/** 콜백으로 돌아온 state 가 시작할 때 심어 둔 쿠키와 같은지 (CSRF 방어) */
function matchesSavedState(req: NextRequest, state: string | null): boolean {
  const saved = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  return Boolean(state && saved && state === saved);
}

/**
 * 애플이 최초 인가 때만 보내 주는 `user` JSON 에서 이름을 꺼낸다.
 *
 * `{"name":{"firstName":"길동","lastName":"홍"},"email":"…"}` 형태다.
 * 한글 이름은 붙여 쓰고(홍길동), 로마자 이름은 띄어 쓴다(Hong Gildong).
 */
function parseAppleUserName(raw: string | null): string | null {
  if (!raw) return null;

  let parsed: { name?: { firstName?: string; lastName?: string } };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    // 애플이 형식을 바꿨거나 값이 잘렸다 — 이름 없이 진행한다(로그인을 막지 않는다).
    return null;
  }

  const first = parsed.name?.firstName?.trim() ?? '';
  const last = parsed.name?.lastName?.trim() ?? '';
  if (!first && !last) return null;

  const hangulOnly = /^[가-힣]+$/;
  const separator = hangulOnly.test(first) && hangulOnly.test(last) ? '' : ' ';
  // 한국식으로 성이 앞이다 — 애플은 성을 lastName 으로 준다.
  return [last, first].filter(Boolean).join(separator).slice(0, 100);
}

/**
 * 인가 코드를 NestJS 에서 세션으로 교환하고 쿠키를 심는다.
 * 제공자마다 보내는 본문이 다르므로 호출부가 만들어 넘긴다.
 */
async function exchange(
  req: NextRequest,
  provider: OAuthProvider,
  body: Record<string, string>,
): Promise<NextResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/${provider}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

  // 303 See Other — 애플 콜백은 POST 로 들어온다. 기본값인 307 은 메서드를 보존해서
  // 브라우저가 목적지에 다시 POST 해 버린다. 303 은 어느 쪽이든 GET 으로 넘긴다.
  const response = NextResponse.redirect(url, 303);
  for (const name of ONE_TIME_COOKIES) {
    // 설정할 때와 path 가 같아야 실제로 삭제된다.
    response.cookies.set({ name, value: '', path: cookiePath(provider), maxAge: 0 });
  }
  return response;
}
