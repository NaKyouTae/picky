import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StickerTemplateForm } from '@/components/sticker-template-form';
import { api } from '@/lib/api';
import type { AdminStickerTemplate } from '@/lib/sticker-templates';

export default async function EditStickerTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 없는 id(또는 조회 실패)는 404 로 — 폼에 빈 값을 보여주지 않는다.
  const template = await api
    .get<AdminStickerTemplate>(`/admin/sticker-templates/${id}`, { cache: 'no-store' })
    .catch(() => null);
  if (!template) notFound();

  return (
    <div>
      <Link href="/stickers" className="text-sm text-ink-sub hover:underline">
        ← 스티커 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold">템플릿 수정</h1>
      <div className="mt-6">
        <StickerTemplateForm template={template} />
      </div>
    </div>
  );
}
