import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/constants';

/**
 * 로그아웃 — 세션 쿠키만 지운다.
 * (BFF 캐치올 `/api/[...path]` 보다 이 정적 경로가 우선 매칭된다.)
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
