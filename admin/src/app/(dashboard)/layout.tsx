import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { getAdminSession } from '@/lib/auth';

/**
 * 관리자 화면 레이아웃 — 로그인하지 않았으면 아무 화면도 렌더하지 않는다.
 * proxy 는 쿠키 존재만 확인하므로, 여기서 서버에 토큰 유효성(서명·만료)까지 확인한다.
 * 무효한 세션은 쿠키를 지우는 경로로 보내 리다이렉트 순환을 막는다.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect('/api/auth/logout?reason=expired');

  return (
    <div className="flex min-h-dvh">
      <Sidebar username={session.username} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
