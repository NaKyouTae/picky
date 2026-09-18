import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api';
import { ADMIN_SESSION_COOKIE } from '@/lib/constants';

type LoginBody = { username?: unknown; password?: unknown };
type LoginResult = {
  accessToken: string;
  expiresAt: number;
  admin: { username: string; role: 'ADMIN' };
};

/**
 * 관리자 로그인 — 브라우저는 토큰을 직접 다루지 않는다.
 * NestJS 가 발급한 JWT 를 httpOnly 쿠키로만 저장해 XSS 로 탈취되지 않도록 한다.
 */
export async function POST(req: NextRequest) {
  const { username, password } = (await req.json().catch(() => ({}))) as LoginBody;

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return NextResponse.json({ message: '아이디와 비밀번호를 입력해 주세요.' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ message: '서버에 연결할 수 없습니다.' }, { status: 502 });
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { message?: string } | null;
    return NextResponse.json(
      { message: detail?.message ?? '로그인에 실패했습니다.' },
      { status: res.status },
    );
  }

  const data = (await res.json()) as LoginResult;
  const response = NextResponse.json({ admin: data.admin });

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
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
