'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal } from '@/components/modal';
import {
  CHALLENGE_STATUS_LABELS,
  CHALLENGE_STATUS_STYLES,
  STATUSES,
  type AdminChallengeCategory,
  type ChallengeStatus,
} from '@/lib/challenges';
import { formatDateTime } from '@/lib/users';

type FormValues = {
  name: string;
  emoji: string;
  description: string;
  displayOrder: string;
  status: ChallengeStatus;
};

const EMPTY: FormValues = {
  name: '',
  emoji: '',
  description: '',
  displayOrder: '0',
  status: 'PUBLISHED',
};

const LABEL = 'block text-sm font-medium';
const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * 챌린지 카테고리 관리.
 * 카테고리는 수가 적어 페이지네이션 없이 전체를 보여주고, 등록/수정은 모달에서 처리한다.
 * 연결된 챌린지·그룹이 있으면 삭제할 수 없으므로 보관(ARCHIVED)으로 숨긴다.
 */
export function ChallengeCategoriesTable({ categories }: { categories: AdminChallengeCategory[] }) {
  const router = useRouter();
  /** null = 닫힘, 'new' = 등록, 그 외 = 수정 대상 */
  const [editing, setEditing] = useState<AdminChallengeCategory | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(target: AdminChallengeCategory | 'new') {
    setEditing(target);
    setError(null);
    setValues(
      target === 'new'
        ? EMPTY
        : {
            name: target.name,
            emoji: target.emoji ?? '',
            description: target.description ?? '',
            displayOrder: String(target.displayOrder),
            status: target.status,
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

    // 빈 칸은 null 로 보낸다 — 생략하면 수정에서 "그대로 두기" 가 되어 지워지지 않는다.
    const body = {
      name: values.name.trim(),
      emoji: values.emoji.trim() || null,
      description: values.description.trim() || null,
      displayOrder: Number(values.displayOrder) || 0,
      status: values.status,
    };

    const isNew = editing === 'new';
    try {
      const res = await fetch(
        isNew
          ? '/api/admin/challenge-categories'
          : `/api/admin/challenge-categories/${(editing as AdminChallengeCategory).id}`,
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

  async function handleDelete(category: AdminChallengeCategory) {
    if (!window.confirm(`'${category.name}' 카테고리를 삭제할까요?`)) return;

    setPending('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/challenge-categories/${category.id}`, {
        method: 'DELETE',
      });
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
        <p className="text-sm text-ink-sub">앱 메인 화면에 공개 카테고리가 순서대로 나열됩니다.</p>
        <button
          type="button"
          onClick={() => open('new')}
          className="h-11 shrink-0 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 sm:h-10"
        >
          카테고리 등록
        </button>
      </div>

      {/* 모바일 — 표 대신 카드. 카드를 누르면 수정 모달이 열린다 */}
      <div className="mt-4 space-y-2 lg:hidden">
        {categories.length === 0 && (
          <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-ink-sub">
            등록된 카테고리가 없습니다.
          </p>
        )}
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => open(category)}
            className="block w-full rounded-xl border border-line bg-white p-4 text-left active:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {category.emoji} {category.name}
                </p>
                <p className="mt-0.5 text-sm text-ink-sub">{category.description ?? '—'}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CHALLENGE_STATUS_STYLES[category.status]}`}
              >
                {CHALLENGE_STATUS_LABELS[category.status]}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-xs text-ink-sub">
              <span>순서 {category.displayOrder}</span>
              <span>챌린지 {category._count.challenges}</span>
              <span>참여 그룹 {category._count.groups}</span>
              <span className="ml-auto">{formatDateTime(category.updatedAt)}</span>
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
                설명
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                챌린지
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                참여 그룹
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                수정일
              </th>
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-sub">
                  등록된 카테고리가 없습니다.
                </td>
              </tr>
            )}
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink-sub">{category.displayOrder}</td>
                <td className="px-4 py-3 font-medium">
                  {category.emoji} {category.name}
                </td>
                <td className="px-4 py-3 text-ink-sub">{category.description ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHALLENGE_STATUS_STYLES[category.status]}`}
                  >
                    {CHALLENGE_STATUS_LABELS[category.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-sub">{category._count.challenges}</td>
                <td className="px-4 py-3 text-ink-sub">{category._count.groups}</td>
                <td className="px-4 py-3 text-ink-sub">{formatDateTime(category.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => open(category)}
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
        title={editing === 'new' ? '카테고리 등록' : '카테고리 수정'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={LABEL}>
                이름
              </label>
              <input
                id="name"
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
                required
                maxLength={40}
                placeholder="둘이서"
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="emoji" className={LABEL}>
                이모지
              </label>
              <input
                id="emoji"
                value={values.emoji}
                onChange={(event) => set('emoji', event.target.value)}
                maxLength={8}
                placeholder="💞"
                className={FIELD}
              />
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
              maxLength={120}
              placeholder="늘 하던 데이트 말고"
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
              <label htmlFor="status" className={LABEL}>
                상태
              </label>
              <select
                id="status"
                value={values.status}
                onChange={(event) => set('status', event.target.value as ChallengeStatus)}
                className={FIELD}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {CHALLENGE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-brand-600">{error}</p>}

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

/** 서버가 준 메시지를 그대로 보여준다 (연결된 챌린지가 있어 삭제 못 하는 경우 등) */
async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    return message ?? `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}
