import { StickerTemplateList } from '@/components/sticker-template-list';
import { api } from '@/lib/api';
import type { StickerTemplate } from '@/lib/sticker-templates';

// 관리자가 템플릿을 등록/공개하면 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function StickerPage() {
  const templates = await api
    .get<StickerTemplate[]>('/sticker-templates', { cache: 'no-store' })
    .catch(() => [] as StickerTemplate[]);

  return <StickerTemplateList templates={templates} />;
}
