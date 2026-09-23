import { api } from '@/lib/api';

type Health = { status: string; timestamp: string };

export default async function DashboardPage() {
  const health = await api.get<Health>('/health').catch(() => null);

  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">대시보드</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="text-sm text-ink-sub">서버 상태</p>
          <p className="mt-2 text-lg font-semibold">
            {health ? `✅ ${health.status}` : '❌ 연결 실패'}
          </p>
        </div>
      </div>
    </div>
  );
}
