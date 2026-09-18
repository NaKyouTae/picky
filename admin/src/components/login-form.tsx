'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { SAVED_USERNAME_KEY } from '@/lib/constants';

export function LoginForm({ expired = false, from }: { expired?: boolean; from?: string }) {
  const router = useRouter();
  // 저장된 아이디는 서버 렌더에 없고 클라이언트에만 있으므로 useSyncExternalStore 로 읽는다
  // (effect 에서 setState 하면 hydration 직후 한 번 더 렌더되고 lint 도 걸린다).
  const savedUsername = useSyncExternalStore(subscribeStorage, readSavedUsername, () => null);

  const [usernameInput, setUsernameInput] = useState<string | null>(null);
  const [rememberInput, setRememberInput] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 사용자가 직접 입력하기 전까지는 저장된 값을 그대로 보여준다.
  const username = usernameInput ?? savedUsername ?? '';
  const remember = rememberInput ?? savedUsername !== null;

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

      // 아이디만 저장한다 — 비밀번호를 localStorage 에 두면 XSS 한 번에 관리자 계정이 통째로 털린다.
      try {
        if (remember) localStorage.setItem(SAVED_USERNAME_KEY, username);
        else localStorage.removeItem(SAVED_USERNAME_KEY);
      } catch {
        // 저장 실패는 로그인 자체를 막지 않는다.
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
            onChange={(e) => setUsernameInput(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none transition-colors focus:border-brand-500 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            비밀번호
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={pending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-line pl-3 pr-11 text-sm outline-none transition-colors focus:border-brand-500 disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-sub hover:bg-gray-100"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
      </div>

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-sub">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRememberInput(e.target.checked)}
          className="h-4 w-4 accent-brand-500"
        />
        아이디 저장
      </label>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-600"
        >
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

/** localStorage 는 시크릿 모드/차단 환경에서 접근 자체가 예외를 던질 수 있다. */
function readSavedUsername(): string | null {
  try {
    return localStorage.getItem(SAVED_USERNAME_KEY);
  } catch {
    return null;
  }
}

/** 다른 탭에서 아이디 저장을 바꾸면 이 탭에도 반영된다. */
function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3 3.9M6.3 6.4A18 18 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}
