import { UsersTable } from '@/components/users-table';

export default function UsersPage() {
  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">사용자</h1>
      <p className="mt-2 text-sm text-ink-sub">가입한 사용자와 연결된 SNS 계정을 확인합니다.</p>
      <div className="mt-6">
        <UsersTable />
      </div>
    </div>
  );
}
