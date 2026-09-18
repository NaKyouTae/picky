import { GoogleLoginButton } from '@/components/google-login-button';
import { KakaoLoginButton } from '@/components/kakao-login-button';
import { LogoutButton } from '@/components/logout-button';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

type Health = { status: string; timestamp: string };

const LOGIN_ERRORS: Record<string, string> = {
  cancelled: '로그인을 취소했습니다.',
  invalid_state: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  login_failed: '로그인에 실패했습니다. 다시 시도해 주세요.',
  google_unavailable: '구글 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  kakao_unavailable: '카카오 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [health, session, { error }] = await Promise.all([
    api.get<Health>('/health').catch(() => null),
    getSession(),
    searchParams,
  ]);

  return (
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Picky</h1>
      <p className="mt-1 text-sm text-ink-sub">순간을 고르는 가장 쉬운 방법</p>

      <section className="mt-6 rounded-2xl border border-line p-4">
        <h2 className="text-sm font-semibold">서버 연결</h2>
        <p className="mt-1 text-sm text-ink-sub">
          {health ? `✅ ${health.status} · ${health.timestamp}` : '❌ 서버에 연결할 수 없습니다.'}
        </p>
      </section>

      {error && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {LOGIN_ERRORS[error] ?? '로그인 중 문제가 발생했습니다.'}
        </p>
      )}

      {session ? (
        <section className="mt-6 space-y-3">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-sm font-semibold">{session.name}님, 반가워요</p>
            <p className="mt-1 text-sm text-ink-sub">{session.email}</p>
          </div>
          <LogoutButton />
        </section>
      ) : (
        <div className="mt-6 space-y-3">
          <GoogleLoginButton />
          <KakaoLoginButton />
        </div>
      )}
    </div>
  );
}
