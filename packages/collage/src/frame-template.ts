/**
 * 사각 프레임(폴라로이드) 템플릿 생성 — 브라우저 전용 순수 함수.
 *
 * 이미지를 올려 검정 영역을 검출하는 경로와 달리, 여기서는 **그리기 전에 좌표를 이미 안다.**
 * 그래서 검출이 필요 없고, 가려진 칸의 위치도 정확하다.
 */

import type { Slot } from './collage';

/** 프레임 한 장 = 흰 판. 값은 템플릿 픽셀 기준 */
export type FrameSpec = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** 시계방향 라디안 */
  angle: number;
};

export type FrameLayout = { width: number; height: number; frames: FrameSpec[] };

export type FrameOptions = {
  width: number;
  height: number;
  count: number;
  /** 프레임 폭 — 캔버스 폭 대비 비율 */
  frameWidth: number;
  /** 프레임 세로 ÷ 가로 */
  frameRatio: number;
  /** 기울기 폭(도). 프레임마다 이 범위 안에서 번갈아 기울어진다 */
  angleSpread: number;
  /** 서로 겹치는 정도 (0 = 안 겹침) */
  overlap: number;
  arrangement: 'diagonal' | 'grid';
  /** 좌·우·상 테두리 두께 — 프레임 폭 대비 */
  border: number;
  /** 하단 테두리 두께 — 프레임 폭 대비. 폴라로이드는 아래가 두껍다 */
  bottomBorder: number;
  /** 그림자 진하기 (0 = 없음) */
  shadowAlpha: number;
  background: 'white' | 'transparent';
};

/**
 * 프레임별 기울기 배수 — 난수를 쓰지 않는다.
 * 같은 옵션이면 항상 같은 PNG 가 나와야 slots 와 이미지가 어긋나지 않는다.
 */
const TILT = [-1, 0.65, -0.3, 1, -0.75, 0.45];

/** 생성 패널의 시작값 — 폴라로이드 지그재그 4칸 */
export const DEFAULT_FRAME_OPTIONS: FrameOptions = {
  width: 1080,
  height: 1200,
  count: 4,
  frameWidth: 0.28,
  frameRatio: 1.12,
  angleSpread: 14,
  overlap: 0.3,
  arrangement: 'diagonal',
  border: 0.07,
  bottomBorder: 0.2,
  shadowAlpha: 0.28,
  background: 'white',
};

/** 프레임 네 꼭짓점을 템플릿 좌표로 (canvas 의 translate+rotate 와 같은 변환) */
function cornersOf(frame: FrameSpec) {
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);
  const half: [number, number][] = [
    [-frame.w / 2, -frame.h / 2],
    [frame.w / 2, -frame.h / 2],
    [frame.w / 2, frame.h / 2],
    [-frame.w / 2, frame.h / 2],
  ];
  return half.map(([lx, ly]) => ({
    x: frame.cx + lx * cos - ly * sin,
    y: frame.cy + lx * sin + ly * cos,
  }));
}

/**
 * 배치 전체를 캔버스 안으로 넣는다.
 *
 * 프레임을 기울이면 차지하는 영역이 회전 전보다 커지므로, 회전을 반영한 실제 외곽을
 * 재서 필요한 만큼 줄이고 가운데로 옮긴다. 늘리지는 않는다 — 크기 슬라이더가 의미를 잃는다.
 */
function fitToCanvas(frames: FrameSpec[], width: number, height: number): FrameSpec[] {
  if (frames.length === 0) return frames;

  // 그림자가 잘리지 않도록 프레임 폭에 비례한 여백을 함께 잡는다 (drawFrameTemplate 의 blur·offset 기준)
  const pad = Math.max(...frames.map((frame) => frame.w)) * 0.11;
  const points = frames.flatMap(cornersOf);
  const minX = Math.min(...points.map((p) => p.x)) - pad;
  const maxX = Math.max(...points.map((p) => p.x)) + pad;
  const minY = Math.min(...points.map((p) => p.y)) - pad;
  const maxY = Math.max(...points.map((p) => p.y)) + pad;

  const scale = Math.min(1, width / (maxX - minX), height / (maxY - minY));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return frames.map((frame) => ({
    cx: width / 2 + (frame.cx - centerX) * scale,
    cy: height / 2 + (frame.cy - centerY) * scale,
    w: frame.w * scale,
    h: frame.h * scale,
    angle: frame.angle,
  }));
}

export function buildLayout(options: FrameOptions): FrameLayout {
  const { width, height, count, frameWidth, frameRatio, angleSpread, overlap, arrangement } =
    options;

  const w = width * frameWidth;
  const h = w * frameRatio;
  const angleOf = (index: number) =>
    ((angleSpread * TILT[index % TILT.length]) * Math.PI) / 180;

  if (arrangement === 'diagonal') {
    // 왼쪽 위에서 오른쪽 아래로 한 칸씩 내려간다. overlap 이 크면 간격이 좁아져 겹친다.
    const stepX = w * (1 - overlap);
    const stepY = h * (1 - overlap);
    const startX = (width - ((count - 1) * stepX + w)) / 2 + w / 2;
    const startY = (height - ((count - 1) * stepY + h)) / 2 + h / 2;

    const frames = Array.from({ length: count }, (_, i) => ({
      cx: startX + i * stepX,
      cy: startY + i * stepY,
      w,
      h,
      angle: angleOf(i),
    }));
    return { width, height, frames: fitToCanvas(frames, width, height) };
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  // 격자는 기본 간격을 조금 띄우고, overlap 만큼 당긴다
  const stepX = w * (1.15 - overlap);
  const stepY = h * (1.15 - overlap);
  const startX = (width - ((cols - 1) * stepX + w)) / 2 + w / 2;
  const startY = (height - ((rows - 1) * stepY + h)) / 2 + h / 2;

  const frames = Array.from({ length: count }, (_, i) => ({
    cx: startX + (i % cols) * stepX,
    cy: startY + Math.floor(i / cols) * stepY,
    w,
    h,
    angle: angleOf(i),
  }));
  return { width, height, frames: fitToCanvas(frames, width, height) };
}

/** 프레임 안쪽(= 사진 자리) — 흰 판보다 작고, 하단 테두리가 두꺼워 위로 밀려 있다 */
function holeOf(frame: FrameSpec, options: FrameOptions): Slot {
  const side = frame.w * options.border;
  const bottom = frame.w * options.bottomBorder;
  const w = frame.w - side * 2;
  const h = frame.h - side - bottom;

  // 프레임 로컬 기준 위로 올라간 만큼을 프레임 각도로 돌려 템플릿 좌표로 옮긴다
  const dy = (side - bottom) / 2;
  return {
    cx: frame.cx - dy * Math.sin(frame.angle),
    cy: frame.cy + dy * Math.cos(frame.angle),
    w,
    h,
    angle: frame.angle,
    // 생성한 값이라 검출 오차가 없다
    fillRatio: 1,
  };
}

export function layoutToSlots(layout: FrameLayout, options: FrameOptions): Slot[] {
  return layout.frames.map((frame) => holeOf(frame, options));
}

/**
 * 템플릿 레이어를 그린다 — 흰 판과 그림자는 남기고 사진 자리는 투명하게 뚫는다.
 *
 * 프레임을 하나씩 "판 → 구멍" 순서로 처리한다. 그래야 뒤에 그리는 프레임의 흰 판이
 * 앞 프레임의 구멍을 덮어, 겹쳐 놓은 사진처럼 보인다.
 */
export function drawFrameTemplate(
  ctx: CanvasRenderingContext2D,
  layout: FrameLayout,
  options: FrameOptions,
  scale = 1,
): void {
  const width = layout.width * scale;
  const height = layout.height * scale;

  ctx.clearRect(0, 0, width, height);
  if (options.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  for (const frame of layout.frames) {
    const w = frame.w * scale;
    const h = frame.h * scale;

    // 흰 판 + 그림자
    ctx.save();
    ctx.translate(frame.cx * scale, frame.cy * scale);
    ctx.rotate(frame.angle);
    if (options.shadowAlpha > 0) {
      ctx.shadowColor = `rgba(0, 0, 0, ${options.shadowAlpha})`;
      ctx.shadowBlur = w * 0.06;
      ctx.shadowOffsetX = w * 0.02;
      ctx.shadowOffsetY = w * 0.03;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    // 사진 자리를 투명하게 뚫는다 (destination-out 은 칠하는 대신 지운다)
    const hole = holeOf(frame, options);
    ctx.save();
    ctx.translate(hole.cx * scale, hole.cy * scale);
    ctx.rotate(hole.angle);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.fillRect(
      (-hole.w * scale) / 2,
      (-hole.h * scale) / 2,
      hole.w * scale,
      hole.h * scale,
    );
    ctx.restore();
  }
}
