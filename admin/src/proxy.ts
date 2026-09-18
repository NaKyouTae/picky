import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, LOGIN_PATH } from '@/lib/constants';

/**
 * Next 16 의 proxy(구 middleware) — 세션 쿠키가 없으면 로그인 페이지로 보낸다.
 * (토큰의 유효성/만료 검증은 NestJS 가 담당 — 여기서는 1차 차단만)
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (pathname === LOGIN_PATH) {
    if (hasSession) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    // API 프록시 호출은 리다이렉트 대신 401 로 응답한다.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const url = new URL(LOGIN_PATH, req.url);
    const from = `${pathname}${search}`;
    if (from !== '/') url.searchParams.set('from', from);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 로그인 API, 정적 파일은 검사 제외
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)'],
};
