import { KakaoLoginButton } from '@/components/kakao-login-button';
import { api } from '@/lib/api';

type Health = { status: string; timestamp: string };

export default async function HomePage() {
  const health = await api.get<Health>('/health').catch(() => null);

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

      <button
        type="button"
        className="mt-6 h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
      >
        시작하기
      </button>

      <div className="mt-3">
        <KakaoLoginButton />
      </div>
    </div>
  );
}
