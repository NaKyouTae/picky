import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/constants';

/**
 * BFF 프록시 — 브라우저 → Next API Route → NestJS
 * 서버 주소를 클라이언트에 노출하지 않고, httpOnly 쿠키의 JWT 를
 * 서버 사이드에서만 Authorization 헤더로 바꿔 붙입니다
 * (NestJS 의 JwtAuthGuard 는 쿠키가 아니라 Authorization 헤더를 봅니다).
 */
async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const search = req.nextUrl.search;
  const target = `${API_BASE_URL}/${path.join('/')}${search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('content-length');

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
    cache: 'no-store',
  });

  const response = new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
  });

  res.headers.forEach((value, key) => {
    if (['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) return;
    if (key === 'set-cookie') return;
    response.headers.set(key, value);
  });

  res.headers.getSetCookie?.().forEach((cookie) => response.headers.append('set-cookie', cookie));

  return response;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
