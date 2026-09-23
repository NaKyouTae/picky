import { MembershipPlansTable } from '@/components/membership-plans-table';
import { api } from '@/lib/api';
import type { AdminMembershipPlan } from '@/lib/membership-plans';

// 등록/수정이 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function MembershipPlansPage() {
  const plans = await api
    .get<AdminMembershipPlan[]>('/admin/membership-plans', { cache: 'no-store' })
    .catch(() => [] as AdminMembershipPlan[]);

  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">회원권</h1>
      <p className="mt-2 text-sm text-ink-sub">
        개월 수와 금액으로 만드는 기간권입니다. 구매하면 그 기간만큼 유료 콜라주 템플릿을 쓸 수
        있습니다.
      </p>
      <div className="mt-6">
        <MembershipPlansTable plans={plans} />
      </div>
    </div>
  );
}
