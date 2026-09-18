import { LoginForm } from '@/components/login-form';

export const metadata = { title: '로그인 | Picky Admin' };

/** 쿼리(expired/from)는 서버에서 읽어 넘긴다 — 클라이언트 훅을 쓰면 폼이 Suspense 뒤로 밀려 초기 HTML 이 비어 보인다. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; from?: string }>;
}) {
  const { expired, from } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight">
            Picky <span className="text-brand-500">Admin</span>
          </p>
          <p className="mt-2 text-sm text-ink-sub">관리자 전용 페이지입니다.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
          {/* 오픈 리다이렉트 방지 — 내부 경로만 복귀 대상으로 허용 */}
          <LoginForm
            expired={expired === '1'}
            from={from?.startsWith('/') && !from.startsWith('//') ? from : undefined}
          />
        </div>

        <p className="mt-6 text-center text-xs text-ink-sub">
          계정 정보는 서버 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  );
}
