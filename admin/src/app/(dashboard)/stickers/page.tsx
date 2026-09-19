import { StickerTemplatesTable } from '@/components/sticker-templates-table';

export default function StickersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">스티커</h1>
      <p className="mt-2 text-sm text-ink-sub">
        사진 콜라주 템플릿을 등록합니다. 템플릿 이미지에 번호를 매긴 사진 칸을 지정해 두면, 앱에서
        고른 사진이 그 번호대로 채워져 한 장으로 합쳐집니다.
      </p>
      <div className="mt-6">
        <StickerTemplatesTable />
      </div>
    </div>
  );
}
