import { NoticesTable } from '@/components/notices-table';

// 목록은 클라이언트 컴포넌트가 BFF 로 직접 불러온다 (검색·필터·페이지 이동이 있어서).
export const dynamic = 'force-dynamic';

export default function NoticesPage() {
  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">공지사항</h1>
      <p className="mt-2 text-sm text-ink-sub">
        앱 마이페이지 → 공지사항에 보이는 글입니다. 공개 상태이고 게시일시가 지난 공지만 노출됩니다.
      </p>
      <div className="mt-6">
        <NoticesTable />
      </div>
    </div>
  );
}
