import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, LOGIN_PATH } from '@/lib/constants';

function clearSession(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

/** 로그아웃 버튼 — 세션 쿠키 제거 */
export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}

/**
 * 만료·위조된 세션 정리용 GET.
 * 쿠키만 남고 토큰이 무효인 상태에서 곧바로 /login 으로 보내면
 * proxy 가 "쿠키 있음 → /" 로 되돌려 무한 리다이렉트가 된다.
 * 여기서 쿠키를 지우고 로그인 화면으로 보내 순환을 끊는다.
 */
export async function GET(req: NextRequest) {
  const url = new URL(LOGIN_PATH, req.url);
  if (req.nextUrl.searchParams.get('reason') === 'expired') {
    url.searchParams.set('expired', '1');
  }
  const from = req.nextUrl.searchParams.get('from');
  if (from?.startsWith('/')) url.searchParams.set('from', from);

  return clearSession(NextResponse.redirect(url));
}
