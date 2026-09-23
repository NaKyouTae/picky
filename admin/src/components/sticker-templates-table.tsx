'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { StickerTemplateForm } from '@/components/sticker-template-form';
import {
  STICKER_LIST_LIMIT,
  STICKER_PRICING_LABELS,
  STICKER_PRICING_STYLES,
  STICKER_STATUSES,
  STICKER_STATUS_LABELS,
  STICKER_STATUS_STYLES,
  type AdminStickerTemplate,
  type AdminStickerTemplatePage,
  type StickerTemplateStatus,
  toPricing,
} from '@/lib/sticker-templates';
import { formatDateTime } from '@/lib/users';

const COLUMN_COUNT = 6;

/** 조회 조건 — 필터가 걸리면 전체 순서를 알 수 없으므로 드래그를 막는다 */
type Filters = { query: string; status: StickerTemplateStatus | '' };

const EMPTY_FILTERS: Filters = { query: '', status: '' };

type Loaded = {
  key: string;
  items: AdminStickerTemplate[] | null;
  error: string | null;
};

/**
 * 스티커 템플릿 목록 — 행을 끌어 노출 순서를 바꾼다.
 *
 * 순서는 목록 전체를 한 번에 다시 매기는 구조라 페이지를 나누지 않고 모두 불러온다
 * (관리자가 직접 등록하는 규모라 수백 건을 넘지 않는다). 검색·상태 필터가 걸려 있으면
 * 화면에 보이는 행이 전체가 아니므로 드래그를 비활성화한다.
 */
export function StickerTemplatesTable() {
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /** 저장 후 같은 조건으로 다시 불러오기 위한 값 */
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  /** 드래그 중인 행의 인덱스 (null 이면 드래그 중 아님) */
  const [dragging, setDragging] = useState<number | null>(null);
  /** 드롭되면 그 자리로 들어갈 인덱스 */
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  /** 모달에서 수정·삭제할 템플릿 (null 이면 모달 닫힘) */
  const [editing, setEditing] = useState<AdminStickerTemplate | null>(null);

  const key = JSON.stringify([filters, reloadToken]);
  const loading = !loaded || loaded.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const [current] = JSON.parse(key) as [Filters, number];

    const params = new URLSearchParams({ take: String(STICKER_LIST_LIMIT) });
    if (current.query) params.set('q', current.query);
    if (current.status) params.set('status', current.status);

    void (async () => {
      try {
        const res = await fetch(`/api/admin/sticker-templates?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
        const page = (await res.json()) as AdminStickerTemplatePage;
        setLoaded({ key, items: page.items, error: null });
      } catch (e) {
        // 다음 요청이 시작되며 취소된 경우는 오류가 아니다.
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          items: null,
          error: e instanceof Error ? e.message : '템플릿 목록을 불러올 수 없습니다.',
        });
      }
    })();

    return () => controller.abort();
  }, [key]);

  function applyFilters(next: Filters) {
    setOrderError(null);
    setFilters(next);
  }

  function reload() {
    setReloadToken((token) => token + 1);
  }

  const items = loading ? [] : (loaded?.items ?? []);
  const error = loading ? null : (loaded?.error ?? null);
  const filtered = Boolean(filters.query || filters.status);
  // 필터가 걸린 목록은 일부만 보이므로 그 순서를 전체 순서로 저장하면 안 된다.
  const sortable = !filtered && !loading && !error && items.length > 1;
  /** 행 대신 보여줄 안내 (없으면 null) — 표와 모바일 카드가 같이 쓴다 */
  const message = loading
    ? '불러오는 중…'
    : (error ??
      (items.length === 0
        ? filtered
          ? '조건에 맞는 템플릿이 없습니다.'
          : '등록된 템플릿이 없습니다.'
        : null));

  /** 드래그한 행을 목표 자리로 옮기고 서버에 전체 순서를 저장한다 */
  async function commitReorder(from: number, to: number) {
    if (from === to) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    // 낙관적 반영 — 드래그를 놓자마자 새 순서를 보여준다.
    setLoaded({ key, items: next, error: null });
    setSaving(true);
    setOrderError(null);

    try {
      const res = await fetch('/api/admin/sticker-templates/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      if (!res.ok) throw new Error(await readError(res));
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : '순서를 저장하지 못했습니다.');
      // 저장이 실패하면 화면과 서버가 어긋나므로 서버 순서를 다시 읽어 되돌린다.
      reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ ...filters, query: input.trim() });
          }}
          className="flex w-full gap-2 sm:w-auto"
        >
          <input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="제목 검색"
            aria-label="제목 검색"
            className="h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:w-60"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 sm:h-10"
          >
            검색
          </button>
        </form>

        <select
          value={filters.status}
          onChange={(event) =>
            applyFilters({ ...filters, status: event.target.value as StickerTemplateStatus | '' })
          }
          aria-label="상태 필터"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-500 sm:h-10 sm:flex-none"
        >
          <option value="">전체 상태</option>
          {STICKER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STICKER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        {filtered && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              applyFilters(EMPTY_FILTERS);
            }}
            className="h-11 rounded-lg border border-line bg-white px-4 text-sm text-ink-sub hover:bg-gray-100 sm:h-10"
          >
            초기화
          </button>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-sub">
        {filtered ? (
          '검색·필터를 끄면 순서를 바꿀 수 있습니다.'
        ) : (
          <>
            {/* HTML5 드래그는 터치에서 동작하지 않으므로 모바일은 화살표 버튼으로 옮긴다 */}
            <span className="lg:hidden">
              카드의 ▲▼ 로 앱에 보이는 순서를 바꿉니다. 위에 있을수록 먼저 보입니다.
            </span>
            <span className="hidden lg:inline">
              행 왼쪽 손잡이를 끌어 앱에 보이는 순서를 바꿉니다. 위에 있을수록 먼저 보입니다.
            </span>
          </>
        )}
        {saving && <span className="ml-2 text-ink">저장 중…</span>}
      </p>

      {orderError && <p className="mt-2 text-sm text-brand-600">{orderError}</p>}

      {/* 모바일 — 표 대신 카드. 카드를 누르면 수정 모달, ▲▼ 로 순서를 바꾼다 */}
      <div className="mt-2 space-y-2 lg:hidden">
        {message ? (
          <p
            className={`rounded-xl border border-line bg-white px-4 py-10 text-center text-sm ${
              error ? 'text-brand-600' : 'text-ink-sub'
            }`}
          >
            {message}
          </p>
        ) : (
          items.map((template, index) => (
            <div
              key={template.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-white p-3"
            >
              {sortable && (
                <div className="flex shrink-0 flex-col gap-1">
                  <MoveButton
                    label={`${template.title} 위로`}
                    disabled={index === 0 || saving}
                    onClick={() => void commitReorder(index, index - 1)}
                  >
                    ▲
                  </MoveButton>
                  <MoveButton
                    label={`${template.title} 아래로`}
                    disabled={index === items.length - 1 || saving}
                    onClick={() => void commitReorder(index, index + 1)}
                  >
                    ▼
                  </MoveButton>
                </div>
              )}

              <button
                type="button"
                onClick={() => setEditing(template)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={template.previewImageUrl ?? template.imageUrl}
                    alt=""
                    fill
                    sizes="56px"
                    unoptimized
                    className="object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{template.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STICKER_STATUS_STYLES[template.status]}`}
                    >
                      {STICKER_STATUS_LABELS[template.status]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STICKER_PRICING_STYLES[toPricing(template.isPaid)]}`}
                    >
                      {STICKER_PRICING_LABELS[toPricing(template.isPaid)]}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-ink-sub">
                    사진 {template.slotCount}칸 · {formatDateTime(template.createdAt)}
                  </span>
                </span>
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 hidden overflow-x-auto rounded-xl border border-line bg-white lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-sub">
              <th scope="col" className="w-10 px-2 py-3 font-medium">
                <span className="sr-only">순서</span>
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                미리보기
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                제목
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                상태
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                이용 조건
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                등록일
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-ink-sub">
                  불러오는 중…
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-brand-600">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-10 text-center text-ink-sub">
                  {filtered ? '조건에 맞는 템플릿이 없습니다.' : '등록된 템플릿이 없습니다.'}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              items.map((template, index) => (
                <tr
                  key={template.id}
                  draggable={sortable}
                  onDragStart={(event) => {
                    setDragging(index);
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox 는 데이터가 없으면 드래그를 시작하지 않는다.
                    event.dataTransfer.setData('text/plain', template.id);
                  }}
                  onDragOver={(event) => {
                    if (dragging === null) return;
                    // 기본 동작을 막아야 이 행이 드롭을 받을 수 있다.
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOver(index);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging !== null) void commitReorder(dragging, index);
                    setDragging(null);
                    setDragOver(null);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setDragOver(null);
                  }}
                  // 드래그가 끝나면 click 이 따라오지 않으므로 순서 바꾸기와 충돌하지 않는다
                  onClick={() => setEditing(template)}
                  className={[
                    'cursor-pointer border-b border-line last:border-0 hover:bg-gray-50',
                    dragging === index ? 'opacity-40' : '',
                    dragOver === index && dragging !== index ? 'bg-brand-500/5' : '',
                  ].join(' ')}
                >
                  {/* 손잡이를 누르는 것은 순서를 바꾸려는 것이므로 모달을 열지 않는다 */}
                  <td className="px-2 py-1.5" onClick={(event) => event.stopPropagation()}>
                    <span
                      aria-hidden
                      title={sortable ? '끌어서 순서 바꾸기' : undefined}
                      className={`flex h-8 w-6 items-center justify-center text-ink-sub ${
                        sortable ? 'cursor-grab active:cursor-grabbing' : 'opacity-30'
                      }`}
                    >
                      <DragHandleIcon />
                    </span>
                  </td>
                  {/* 세로로 긴 템플릿이 섞여도 행 높이가 일정하도록 박스를 고정하고
                      이미지는 그 안에서 비율을 지켜 줄인다 (contain). */}
                  <td className="px-4 py-1.5">
                    <div className="relative h-12 w-16 overflow-hidden rounded-md bg-gray-100">
                      <Image
                        src={template.previewImageUrl ?? template.imageUrl}
                        alt=""
                        fill
                        sizes="64px"
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-1.5">
                    <p className="font-medium">{template.title}</p>
                    <p className="text-xs text-ink-sub">사진 {template.slotCount}칸</p>
                  </td>
                  <td className="px-4 py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STICKER_STATUS_STYLES[template.status]}`}
                    >
                      {STICKER_STATUS_LABELS[template.status]}
                    </span>
                  </td>
                  <td className="px-4 py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STICKER_PRICING_STYLES[toPricing(template.isPaid)]}`}
                    >
                      {STICKER_PRICING_LABELS[toPricing(template.isPaid)]}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-ink-sub">{formatDateTime(template.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && !error && items.length >= STICKER_LIST_LIMIT && (
        <p className="mt-3 text-sm text-brand-600">
          템플릿이 {STICKER_LIST_LIMIT}개를 넘어 일부만 보이고 있습니다. 순서를 저장하면 보이지 않는
          템플릿의 순서가 밀릴 수 있으니 오래된 템플릿을 보관 처리해 주세요.
        </p>
      )}

      {/* 좌: 입력 / 우: 미리보기 2열이라 넓은 모달을 쓴다.
          Modal 은 열려 있을 때만 children 을 렌더하므로 다른 행을 열면 폼이 초기 상태로 시작한다. */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="콜라주 수정" size="lg">
        {editing && (
          <StickerTemplateForm
            template={editing}
            framed={false}
            onDone={() => {
              setEditing(null);
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

/** 모바일 순서 변경 버튼 — 44px 터치 타깃을 지킨다 */
function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-11 items-center justify-center rounded-lg border border-line text-xs text-ink-sub disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

/** NestJS 예외 필터가 내려주는 message 를 꺼내고, 형식이 다르면 상태 코드로 대체한다 */
async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const message = body?.message;
  if (Array.isArray(message)) return message.join('\n');
  return message ?? `요청이 실패했습니다 (${res.status})`;
}
