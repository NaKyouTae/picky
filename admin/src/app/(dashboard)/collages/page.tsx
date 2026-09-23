import Link from 'next/link';
import { StickerTemplatesTable } from '@/components/sticker-templates-table';

export default function StickersPage() {
  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">콜라주</h1>
      <p className="mt-2 text-sm text-ink-sub">
        등록된 콜라주 템플릿입니다. 새 템플릿은{' '}
        <Link href="/collage-lab" className="font-medium text-ink underline">
          콜라주 실험실
        </Link>
        에서 사진을 넣어 확인한 뒤 등록합니다. 여기서는 제목·공개 상태·노출 순서만 바꿉니다.
      </p>
      <div className="mt-6">
        <StickerTemplatesTable />
      </div>
    </div>
  );
}
