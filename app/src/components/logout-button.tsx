'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** 로그아웃 — 세션 쿠키는 httpOnly 라 서버 라우트에서만 지울 수 있다. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    // 서버 컴포넌트가 새 쿠키 상태로 다시 렌더되도록 갱신
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="h-12 w-full rounded-xl border border-line text-base font-semibold text-ink-sub transition-colors active:bg-canvas disabled:opacity-60"
    >
      {pending ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}
