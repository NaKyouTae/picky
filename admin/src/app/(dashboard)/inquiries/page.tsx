import { InquiriesTable } from '@/components/inquiries-table';

// 목록은 클라이언트 컴포넌트가 BFF 로 직접 불러온다 (검색·필터·페이지 이동이 있어서).
export const dynamic = 'force-dynamic';

export default function InquiriesPage() {
  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">문의</h1>
      <p className="mt-2 text-sm text-ink-sub">
        앱 마이페이지 → 문의하기로 들어온 문의입니다. 답변은 문의에 적힌 이메일로 직접 보내고,
        여기에는 처리 상태와 메모만 남깁니다.
      </p>
      <div className="mt-6">
        <InquiriesTable />
      </div>
    </div>
  );
}
