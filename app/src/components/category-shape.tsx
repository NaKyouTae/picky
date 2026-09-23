import Image from 'next/image';

/**
 * 메인 카드 오른쪽 아래를 채우는 도형 — 디자인에서 내려온 원본 이미지를 그대로 쓴다.
 * 카드가 `overflow-hidden` 이라 바닥에 닿은 부분은 잘려서 화면 밖으로 이어지는 느낌을 준다.
 */
const SHAPES = {
  alone: '/shapes/alone.png',
  tweens: '/shapes/tweens.png',
  baby: '/shapes/baby.png',
};

type ShapeKey = keyof typeof SHAPES;

/**
 * 카테고리 이름 → 도형.
 * 어드민에 도형 필드가 없으므로 이름으로 정해 둔다 — 순서가 바뀌어도 그림이 따라 밀리지 않는다.
 */
const SHAPE_BY_NAME: Record<string, ShapeKey> = {
  혼자서: 'alone',
  함께: 'tweens',
  아기랑: 'baby',
};

/** 이름을 모르는 카테고리는 순서대로 돌려 쓴다 */
const FALLBACK: ShapeKey[] = ['alone', 'tweens', 'baby'];

/**
 * 카테고리의 시각 정체성을 정하는 단일 지점.
 * 도형과 선택 색은 반드시 같은 키에서 나와야 한다 — 따로 계산하면
 * 빨간 도형에 파란 테두리가 붙는 식으로 어긋난다.
 */
export function resolveShapeKey(name: string, index: number): ShapeKey {
  return SHAPE_BY_NAME[name.trim()] ?? FALLBACK[index % FALLBACK.length];
}

/**
 * 선택된 카드 — 도형과 같은 색의 테두리 + 10% 틴트 (디자인 "메인_선택 시" 4596:5601).
 * 틴트는 카드 기본색(#1c1c1c) 위가 아니라 페이지 배경(#121212) 위에 얹힌다.
 */
export const SELECTED_BY_SHAPE: Record<ShapeKey, string> = {
  alone: 'border-picky-red bg-picky-red/10',
  tweens: 'border-picky-yellow bg-picky-yellow/10',
  baby: 'border-picky-blue bg-picky-blue/10',
};

/** 누르고 있는 동안에도 같은 색을 보여 줘서 탭과 선택이 이어져 보이게 한다 */
export const PRESSED_BY_SHAPE: Record<ShapeKey, string> = {
  alone: 'active:border-picky-red active:bg-picky-red/10',
  tweens: 'active:border-picky-yellow active:bg-picky-yellow/10',
  baby: 'active:border-picky-blue active:bg-picky-blue/10',
};

/**
 * '진행중' 배지 (디자인 "메인_진행 중 챌린지 있을 경우" 4598:5671).
 * 노랑만 글자를 어둡게 쓴다 — 배경이 밝아 흰 글씨는 읽히지 않는다.
 */
export const BADGE_BY_SHAPE: Record<ShapeKey, string> = {
  alone: 'bg-picky-red text-night-text',
  tweens: 'bg-picky-yellow text-night',
  baby: 'bg-picky-blue text-night-text',
};

export function CategoryShape({
  name,
  index,
  className,
}: {
  /** 카테고리 이름 — 정해진 도형이 있으면 그것을 쓴다 */
  name: string;
  /** 이름에 매칭되는 도형이 없을 때 쓰는 순번 */
  index: number;
  className?: string;
}) {
  const src = SHAPES[resolveShapeKey(name, index)];

  return <Image src={src} alt="" width={200} height={103} priority className={className} />;
}
