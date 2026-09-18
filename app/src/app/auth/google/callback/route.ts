import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api';
import {
  HOME_PATH,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
} from '@/lib/constants';

type LoginResult = {
  accessToken: string;
  expiresAt: number;
  user: { id: string; email: string; name: string; role: 'USER' | 'ADMIN' };
};

/**
 * 구글 리디렉션 착지점 (구글 콘솔에 등록한 Redirect URI).
 * state 를 쿠키와 대조해 CSRF 를 막고, code 는 NestJS 에서 세션으로 교환한다.
 * 토큰은 브라우저 JS 가 만지지 않도록 httpOnly 쿠키로만 보관한다.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const store = req.cookies;

  const code = params.get('code');
  const state = params.get('state');
  const nonce = store.get(OAUTH_NONCE_COOKIE)?.value;
  const codeVerifier = store.get(OAUTH_VERIFIER_COOKIE)?.value;
  const savedState = store.get(OAUTH_STATE_COOKIE)?.value;

  // 사용자가 동의 화면에서 취소하면 error=access_denied 로 돌아온다.
  if (params.get('error')) {
    return finish(req, 'cancelled');
  }
  if (!code || !state || !savedState || state !== savedState || !nonce || !codeVerifier) {
    return finish(req, 'invalid_state');
  }

  const res = await fetch(`${API_BASE_URL}/auth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, nonce, codeVerifier }),
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) {
    return finish(req, 'login_failed');
  }

  const data = (await res.json()) as LoginResult;
  const response = finish(req, null);

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

  return response;
}

/** 홈으로 돌려보내며 일회용 OAuth 쿠키를 정리한다. */
function finish(req: NextRequest, error: string | null) {
  const url = new URL(HOME_PATH, req.url);
  if (error) url.searchParams.set('error', error);

  const response = NextResponse.redirect(url);
  for (const name of [OAUTH_STATE_COOKIE, OAUTH_NONCE_COOKIE, OAUTH_VERIFIER_COOKIE]) {
    // 설정할 때와 path 가 같아야 실제로 삭제된다.
    response.cookies.set({ name, value: '', path: '/auth/google', maxAge: 0 });
  }
  return response;
}
