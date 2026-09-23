'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LOGIN_PATH } from '@/lib/constants';

/** 로그아웃 — 세션 쿠키는 httpOnly 라 서버 라우트에서만 지울 수 있다. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    // 로그아웃하면 로그인 화면으로 보낸다.
    // replace 라서 뒤로가기로 방금 나온 마이페이지로 돌아가지 않는다.
    router.replace(LOGIN_PATH);
    // 서버 컴포넌트가 새 쿠키 상태로 다시 렌더되도록 갱신
    router.refresh();
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
