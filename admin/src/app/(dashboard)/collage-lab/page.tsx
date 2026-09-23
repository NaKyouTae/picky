import { CollageLab } from '@/components/collage-lab';

export default function CollageLabPage() {
  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">콜라주 실험실</h1>
      <p className="mt-2 text-sm text-ink-sub">
        만들어 온 템플릿 이미지를 올리면 검정 영역을 검출해 사진 자리(위치·크기·각도)를 정하고,
        실제로 사진을 넣어 합성해 봅니다. 검출과 합성은 브라우저에서만 돌아가고, 등록하기 전까지
        서버에 아무것도 올리지 않습니다.
      </p>
      <div className="mt-6">
        <CollageLab />
      </div>
    </div>
  );
}
