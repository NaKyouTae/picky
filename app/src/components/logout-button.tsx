'use client';

import { useState } from 'react';
import { LOGIN_PATH } from '@/lib/constants';

/** 로그아웃 — 세션 쿠키는 httpOnly 라 서버 라우트에서만 지울 수 있다. */
export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    // 로그아웃하면 로그인 화면으로 보낸다.
    //
    // router.replace + router.refresh 로는 로그인 화면에 닿지 못했다 — refresh 가
    // 아직 /mypage 인 현재 주소를 다시 받아오는데, 세션이 사라진 마이페이지는
    // 홈으로 redirect 하므로 그 이동이 replace 를 덮어써 홈에 떨어졌다.
    // 통째로 다시 불러 서버가 로그아웃 상태로 /login 을 그리게 한다 —
    // 클라이언트 라우터 캐시에 남은 로그인 상태 화면도 이때 함께 버려진다.
    // replace 라서 뒤로가기로 방금 나온 마이페이지로 돌아가지 않는다.
    window.location.replace(LOGIN_PATH);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      // 디자인(Figma 4658:3731)은 밑줄 없는 14px 회색 텍스트 두 줄 —
      // 위아래 패딩으로만 누를 수 있는 높이를 벌어 둔다.
      className="py-2 text-left text-[14px] leading-none text-night-sub active:text-night-text disabled:opacity-60"
    >
      {pending ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}
