import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api';
import {
  HOME_PATH,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from '@/lib/constants';

type AuthorizeResult = { url: string; state: string; nonce: string; codeVerifier: string };

/**
 * 구글 로그인 시작.
 * 인가 URL 은 NestJS 가 만든다 (클라이언트 ID/시크릿을 프론트에 두지 않기 위해).
 * 여기서는 돌려받은 일회용 값만 httpOnly 쿠키에 담고 브라우저를 구글로 보낸다.
 */
export async function GET(req: NextRequest) {
  const res = await fetch(`${API_BASE_URL}/auth/google/authorize`, { cache: 'no-store' }).catch(
    () => null,
  );

  if (!res?.ok) {
    return NextResponse.redirect(new URL(`${HOME_PATH}?error=google_unavailable`, req.url));
  }

  const { url, state, nonce, codeVerifier } = (await res.json()) as AuthorizeResult;
  const response = NextResponse.redirect(url);

  for (const [name, value] of [
    [OAUTH_STATE_COOKIE, state],
    [OAUTH_NONCE_COOKIE, nonce],
    [OAUTH_VERIFIER_COOKIE, codeVerifier],
  ] as const) {
    response.cookies.set({
      name,
      value,
      httpOnly: true,
      // 구글에서 돌아오는 top-level 리디렉션에도 쿠키가 실려야 하므로 lax
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/auth/google',
      maxAge: OAUTH_COOKIE_MAX_AGE,
    });
  }

  return response;
}
