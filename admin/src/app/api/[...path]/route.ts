import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api';
import { ADMIN_SESSION_COOKIE } from '@/lib/constants';

/**
 * BFF 프록시 — 브라우저 → Next API Route → NestJS
 * 로그인 세션 JWT(httpOnly 쿠키)를 서버 사이드에서만 Authorization 헤더로 붙여 전달합니다.
 * 세션이 없으면 서버 간 호출용 ADMIN_TOKEN 으로 폴백합니다.
 */
async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const search = req.nextUrl.search;
  const target = `${API_BASE_URL}/${path.join('/')}${search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('content-length');
  const bearer = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || process.env.ADMIN_TOKEN;
  if (bearer) {
    headers.set('authorization', `Bearer ${bearer}`);
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
