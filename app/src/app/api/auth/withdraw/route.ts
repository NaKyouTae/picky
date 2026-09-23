import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/constants';

/**
 * 회원 탈퇴 — NestJS 에 탈퇴를 요청하고, 성공하면 세션 쿠키까지 지운다.
 *
 * BFF 캐치올(`/api/[...path]`)로 보내면 쿠키가 남아 탈퇴한 세션으로 화면이 한 번 더 그려진다.
 * (`/api/auth/logout` 과 같은 이유로 정적 경로를 따로 둔다.)
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!res?.ok) {
    // 실패 사유(만료된 토큰·이미 탈퇴 등)는 그대로 흘리지 않고 한 문장으로 돌려준다.
    return NextResponse.json(
      { message: '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.' },
      { status: res?.status ?? 502 },
    );
  }

  // 우리가 끊지 못한 제공자 목록을 그대로 흘려보낸다 (화면에서 직접 해제하도록 안내한다).
  const body = (await res.json().catch(() => ({}))) as { manualDisconnect?: string[] };
  const response = NextResponse.json({ ok: true, manualDisconnect: body.manualDisconnect ?? [] });
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
