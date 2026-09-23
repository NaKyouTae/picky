import { UserMembershipsTable } from '@/components/user-memberships-table';

// 이용 기간은 시간이 지나면 달라지므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default function UserMembershipsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">회원권</h1>
      <p className="mt-2 text-sm text-ink-sub">
        사용자가 결제한 회원권입니다. 언제 결제했고 언제부터 언제까지 쓸 수 있는지 보여줍니다.
      </p>
      <div className="mt-6">
        <UserMembershipsTable />
      </div>
    </div>
  );
}
