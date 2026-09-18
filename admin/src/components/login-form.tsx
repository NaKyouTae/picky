'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm({ expired = false, from }: { expired?: boolean; from?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = username.trim() !== '' && password !== '' && !pending;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? '로그인에 실패했습니다.');
        setPassword('');
        return;
      }

      // 로그인 직후 원래 가려던 화면으로 복귀 (from 은 서버에서 내부 경로만 걸러 넘어온다)
      router.replace(from ?? '/');
      router.refresh();
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="text-lg font-semibold">로그인</h1>

      {expired && !error && (
        <p className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-sm text-ink-sub">
          세션이 만료되었습니다. 다시 로그인해 주세요.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium">
            아이디
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
            disabled={pending}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none transition-colors focus:border-brand-500 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none transition-colors focus:border-brand-500 disabled:bg-gray-50"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-6 h-11 w-full rounded-lg bg-brand-500 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
