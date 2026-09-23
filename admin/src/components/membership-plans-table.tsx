'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal } from '@/components/modal';
import {
  MAX_MONTHS,
  MAX_PRICE,
  formatKrw,
  monthlyPrice,
  type AdminMembershipPlan,
} from '@/lib/membership-plans';
import { formatDateTime } from '@/lib/users';

/** 숫자 입력은 빈 문자열 상태가 필요하므로(지웠을 때) 폼에서는 문자열로 들고 있는다 */
type FormValues = {
  name: string;
  months: string;
  price: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
};

const EMPTY: FormValues = {
  name: '',
  months: '1',
  price: '',
  description: '',
  displayOrder: '0',
  isActive: true,
};

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 회원권 관리.
 *
 * 회원권은 개월 수 + 금액 조합이라 수가 적고 수시로 추가된다 — 페이지네이션 없이 전체를
 * 보여주고 등록/수정은 모달에서 처리한다 (챌린지 카테고리와 같은 방식).
 * 판매를 멈추려면 삭제하지 말고 '판매 중단' 으로 바꾼다 — 지난 구매 기록이 플랜을 참조한다.
 */
export function MembershipPlansTable({ plans }: { plans: AdminMembershipPlan[] }) {
  const router = useRouter();
  /** null = 닫힘, 'new' = 등록, 그 외 = 수정 대상 */
  const [editing, setEditing] = useState<AdminMembershipPlan | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(target: AdminMembershipPlan | 'new') {
    setEditing(target);
    setError(null);
    setValues(
      target === 'new'
        ? EMPTY
        : {
            name: target.name,
            months: String(target.months),
            price: String(target.price),
            description: target.description ?? '',
            displayOrder: String(target.displayOrder),
            isActive: target.isActive,
          },
    );
  }

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending('save');
    setError(null);

    // 빈칸은 null 로 보낸다 — 생략(undefined)하면 JSON 에서 키가 빠져 기존 설명이 그대로 남는다.
    const body = {
      name: values.name.trim(),
      months: Number(values.months),
      price: Number(values.price),
      description: values.description.trim() || null,
      displayOrder: Number(values.displayOrder) || 0,
      isActive: values.isActive,
    };

    const isNew = editing === 'new';
    try {
      const res = await fetch(
        isNew
          ? '/api/admin/membership-plans'
          : `/api/admin/membership-plans/${(editing as AdminMembershipPlan).id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await readError(res));

      setEditing(null);
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setPending(null);
    }
  }

  async function handleDelete(plan: AdminMembershipPlan) {
    if (!window.confirm(`'${plan.name}' 회원권을 삭제할까요?`)) return;

    setPending('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/membership-plans/${plan.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));

      setEditing(null);
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-sub">
          판매 중인 회원권만 앱 결제 화면에 순서대로 나열됩니다.
        </p>
        <button
          type="button"
          onClick={() => open('new')}
          className="h-11 shrink-0 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 sm:h-10"
        >
          회원권 등록
        </button>
      </div>

      {/* 모바일 — 표 대신 카드. 카드를 누르면 수정 모달이 열린다 */}
      <div className="mt-4 space-y-2 lg:hidden">
        {plans.length === 0 && (
          <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-sub">
            등록된 회원권이 없습니다.
          </p>
        )}
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => open(plan)}
            className="block w-full rounded-xl border border-line bg-white p-4 text-left active:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{plan.name}</p>
                <p className="mt-0.5 text-sm text-ink-sub">{plan.description ?? '—'}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-ink-sub'
                }`}
              >
                {plan.isActive ? '판매 중' : '판매 중단'}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-xs text-ink-sub">
              <span className="font-medium text-ink">{plan.months}개월</span>
              <span className="font-medium text-ink">{formatKrw(plan.price)}</span>
              <span>{monthlyPrice(plan.price, plan.months)}</span>
              <span className="ml-auto">{formatDateTime(plan.updatedAt)}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-white lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="px-4 py-3 font-medium">
                순서
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                이름
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                기간
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                금액
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                월 환산
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                설명
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                판매
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                수정일
              </th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink-sub">
                  등록된 회원권이 없습니다.
                </td>
              </tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink-sub">{plan.displayOrder}</td>
                <td className="px-4 py-3 font-medium">{plan.name}</td>
                <td className="px-4 py-3">{plan.months}개월</td>
                <td className="px-4 py-3 font-medium">{formatKrw(plan.price)}</td>
                <td className="px-4 py-3 text-ink-sub">{monthlyPrice(plan.price, plan.months)}</td>
                <td className="px-4 py-3 text-ink-sub">{plan.description ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-ink-sub'
                    }`}
                  >
                    {plan.isActive ? '판매 중' : '판매 중단'}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-sub">{formatDateTime(plan.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => open(plan)}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    수정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? '회원권 등록' : '회원권 수정'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className={LABEL}>
              이름
            </label>
            <input
              id="name"
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
              required
              maxLength={60}
              placeholder="1개월권"
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="months" className={LABEL}>
                기간 (개월)
              </label>
              <input
                id="months"
                type="number"
                min={1}
                max={MAX_MONTHS}
                step={1}
                value={values.months}
                onChange={(event) => set('months', event.target.value)}
                required
                className={FIELD}
              />
              <p className="mt-1 text-xs text-ink-sub">
                구매하면 이 기간만큼 유료 템플릿이 열립니다.
              </p>
            </div>
            <div>
              <label htmlFor="price" className={LABEL}>
                금액 (원)
              </label>
              <input
                id="price"
                type="number"
                min={0}
                max={MAX_PRICE}
                step={100}
                value={values.price}
                onChange={(event) => set('price', event.target.value)}
                required
                placeholder="3900"
                className={FIELD}
              />
              {/* 자릿수 실수를 바로 알아차리도록 입력값을 사람이 읽는 형태로 되비춘다 */}
              <p className="mt-1 text-xs text-ink-sub">
                {values.price === '' ? ' ' : formatKrw(Number(values.price))}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="description" className={LABEL}>
              한 줄 설명
            </label>
            <input
              id="description"
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={200}
              placeholder="유료 템플릿 무제한"
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="displayOrder" className={LABEL}>
                순서 (작을수록 앞)
              </label>
              <input
                id="displayOrder"
                type="number"
                min={0}
                value={values.displayOrder}
                onChange={(event) => set('displayOrder', event.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="isActive" className={LABEL}>
                판매 상태
              </label>
              <select
                id="isActive"
                value={values.isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(event) => set('isActive', event.target.value === 'ACTIVE')}
                className={FIELD}
              >
                <option value="ACTIVE">판매 중</option>
                <option value="INACTIVE">판매 중단</option>
              </select>
              <p className="mt-1 text-xs text-ink-sub">
                판매를 멈춰도 이미 구매한 기간은 그대로 유지됩니다.
              </p>
            </div>
          </div>

          {error && <p className="whitespace-pre-line text-sm text-brand-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending !== null}
              className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 sm:h-10"
            >
              {pending === 'save' ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-11 rounded-lg border border-line px-4 text-sm font-medium text-ink-sub hover:bg-gray-100 sm:h-10"
            >
              취소
            </button>
            {editing !== null && editing !== 'new' && (
              <button
                type="button"
                onClick={() => void handleDelete(editing)}
                disabled={pending !== null}
                className="ml-auto h-11 rounded-lg px-4 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60 sm:h-10"
              >
                {pending === 'delete' ? '삭제 중…' : '삭제'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

/** 서버가 준 메시지를 그대로 보여준다 (검증 실패 목록 등) */
async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    return message ?? `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}
