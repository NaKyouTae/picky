import { StickerTemplatesTable } from '@/components/sticker-templates-table';

export default function StickersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">스티커</h1>
      <p className="mt-2 text-sm text-ink-sub">
        사진 콜라주 템플릿을 등록합니다. 템플릿은 이미지 한 장이 전부이고, 공개하면 앱 스티커
        시트의 목록에 보입니다. 사진을 어디에 끼워 넣을지는 앱에서 사용자가 직접 정합니다.
      </p>
      <div className="mt-6">
        <StickerTemplatesTable />
      </div>
    </div>
  );
}
