/**
 * 콜라주 템플릿 처리 — 브라우저 전용 순수 함수 모음.
 *
 * 하는 일은 픽셀 배열을 훑는 산수뿐이다. 외부 의존성이 없고 서버도 거치지 않는다.
 *   1) 템플릿의 검정 영역을 찾아 사진이 들어갈 칸(위치·크기·각도)을 알아낸다
 *   2) 그 검정 영역을 투명하게 뚫어 사진 위에 덮을 수 있게 만든다
 *   3) 칸마다 사진을 꽉 채우도록(cover) 잘라 합성한다
 */

/**
 * 사진이 들어갈 칸 한 개. 값은 **템플릿 원본 픽셀** 기준이다.
 *
 * 0~1 로 정규화하지 않는 이유: 회전이 있으면 x 를 폭으로, y 를 높이로 각각 나누는 순간
 * 정사각형이 아닌 템플릿에서 각도가 뒤틀린다. 렌더할 때 배율 하나만 곱하는 편이 안전하다.
 */
export type Slot = {
  /** 칸 중심 */
  cx: number;
  cy: number;
  /** 회전을 풀었을 때의 크기 */
  w: number;
  h: number;
  /** 시계방향 라디안. (-π/4, π/4] 로 정규화되어 있다 */
  angle: number;
  /**
   * 검정 픽셀 수 ÷ 사각형 면적. 1 에 가까울수록 반듯한 사각형이다.
   * 검출이 얼마나 믿을 만한지 보는 진단값이라 서버에 저장하지 않는다 — 앱에서는 비어 있다.
   */
  fillRatio?: number;
};

/**
 * 사진 위에 덮을 템플릿 한 장 + 사진 자리들.
 *
 * 만든 경로가 둘이지만(이미지를 올려 검정을 검출하거나, 프레임을 직접 생성하거나)
 * 결과 모양은 같다 — 그래서 합성·미리보기 코드는 출처를 몰라도 된다.
 */
export type TemplateSource = {
  name: string;
  width: number;
  height: number;
  /** 사진 자리가 투명하게 뚫린 레이어 */
  layer: HTMLCanvasElement;
  slots: Slot[];
};

/** 사진 원본 기준 0~1 크롭 영역. 이 영역이 칸을 꽉 채운다 (CSS object-fit: cover 와 같다) */
export type Crop = { x: number; y: number; w: number; h: number };

export type DetectOptions = {
  /** R·G·B 가 모두 이 값 이하면 검정(= 사진 자리)으로 본다 */
  threshold: number;
  /**
   * 같은 칸으로 묶을 색 차이. 덩어리를 넓힐 때 **시작 픽셀의 색**과 채널마다 비교해
   * 이 값을 넘으면 잇지 않는다.
   *
   * 어두운 색 두 가지를 맞대어 칸을 나눌 수 있게 하려고 둔다 — 예를 들어
   * #121212 와 #1c1c1c 는 차이가 10 이라 8 로 두면 서로 다른 칸이 된다.
   * 구분선을 따로 그리지 않아도 되므로 칸끼리 빈틈없이 붙는다.
   *
   * 이웃끼리 비교하지 않고 시작 픽셀과 비교하는 이유: 경계가 흐려져 중간색이 끼면
   * 18→23→28 처럼 사슬로 이어져 두 칸이 도로 합쳐진다.
   *
   * 크게 두면(= 임계값의 2배 이상) 색을 가리지 않으므로 예전처럼 동작한다.
   */
  colorTolerance: number;
  /** 전체 픽셀의 이 비율 미만인 덩어리는 버린다 (안티에일리어싱 경계·장식 제거) */
  minAreaRatio: number;
  /** 사각형에서 이보다 많이 어긋난 덩어리는 버린다 */
  minFillRatio: number;
};

/**
 * 검출이 왜 실패했는지 알려주는 값들.
 * 칸이 0개로 나올 때 어느 조건이 막았는지 화면에서 짚어 주기 위한 것이다.
 */
export type DetectReport = {
  /** 검정으로 판정된 픽셀 비율 — 0 에 가까우면 임계값이 너무 낮다 */
  blackRatio: number;
  /** 면적 조건에서 걸러진 덩어리 수 */
  tooSmall: number;
  /** 사각형 조건에서 걸러진 덩어리 수 */
  notRectangular: number;
  /** 걸러진 덩어리 중 가장 높았던 사각형 점수 — 조건을 얼마까지 내리면 통과하는지 알 수 있다 */
  bestRejectedFillRatio: number | null;
};

export const DEFAULT_DETECT_OPTIONS: DetectOptions = {
  threshold: 40,
  colorTolerance: 8,
  minAreaRatio: 0.005,
  minFillRatio: 0.7,
};

/**
 * 템플릿에서 사진이 들어갈 칸을 찾는다.
 *
 * 검정 픽셀을 인접한 것끼리 묶고(연결 요소 라벨링), 덩어리마다 가장 작은 회전 사각형을
 * 씌운다. 알파가 아니라 **색**으로 판정하므로 템플릿 배경이 투명하든 흰색이든 상관없다.
 *
 * 묶을 때 색도 함께 본다(`colorTolerance`). 그래서 어두운 색 두 가지를 번갈아 칠하는 것만으로
 * 칸을 나눌 수 있다 — 구분선이나 투명 틈이 없어도 칸끼리 빈틈없이 붙는다.
 */
export function detectSlots(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: DetectOptions = DEFAULT_DETECT_OPTIONS,
): Slot[] {
  return detectSlotsWithReport(data, width, height, options).slots;
}

/** detectSlots 와 같지만 걸러진 이유까지 함께 돌려준다 */
export function detectSlotsWithReport(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: DetectOptions = DEFAULT_DETECT_OPTIONS,
): { slots: Slot[]; report: DetectReport } {
  const total = width * height;
  const minArea = total * options.minAreaRatio;

  // 검정 판정을 한 번만 하고 재사용한다 (덩어리마다 다시 계산하면 느리다)
  const black = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    // 반투명 픽셀은 배경이 비쳐 검정으로 보일 뿐이므로 제외한다
    const opaque = data[p + 3] > 128;
    if (
      opaque &&
      data[p] <= options.threshold &&
      data[p + 1] <= options.threshold &&
      data[p + 2] <= options.threshold
    ) {
      black[i] = 1;
    }
  }

  const seen = new Uint8Array(total);
  const slots: Slot[] = [];

  let blackPixels = 0;
  for (let i = 0; i < total; i++) blackPixels += black[i];

  let tooSmall = 0;
  let notRectangular = 0;
  let bestRejectedFillRatio: number | null = null;

  for (let start = 0; start < total; start++) {
    if (seen[start] || !black[start]) continue;

    // 최소 회전 사각형은 외곽선만으로 정해지므로 테두리 픽셀만 모은다.
    // 칸 하나가 500×500 이면 내부까지 담을 때 25만 점, 외곽만 담으면 2천 점이다.
    const edgeX: number[] = [];
    const edgeY: number[] = [];
    let area = 0;

    // 덩어리를 넓힐 기준 색 — 이웃이 아니라 이 색과 비교한다 (colorTolerance 주석 참고)
    const seedP = start * 4;
    const seedR = data[seedP];
    const seedG = data[seedP + 1];
    const seedB = data[seedP + 2];
    const sameColor = (index: number) => {
      const q = index * 4;
      return (
        Math.abs(data[q] - seedR) <= options.colorTolerance &&
        Math.abs(data[q + 1] - seedG) <= options.colorTolerance &&
        Math.abs(data[q + 2] - seedB) <= options.colorTolerance
      );
    };

    // 재귀 대신 스택 — 큰 덩어리에서 호출 스택이 터진다
    const stack: number[] = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const p = stack.pop() as number;
      const x = p % width;
      const y = (p - x) / width;
      area++;

      const left = x > 0 ? p - 1 : -1;
      const right = x < width - 1 ? p + 1 : -1;
      const up = y > 0 ? p - width : -1;
      const down = y < height - 1 ? p + width : -1;

      // 이웃 중 하나라도 이 칸에 속하지 않으면(또는 이미지 밖이면) 이 픽셀은 외곽이다
      const joins = (n: number) => n >= 0 && black[n] && sameColor(n);
      if (!joins(left) || !joins(right) || !joins(up) || !joins(down)) {
        // 캔버스 좌표계에서 픽셀 (x, y) 의 중심은 (x+0.5, y+0.5) 다.
        // 인덱스를 그대로 쓰면 사각형이 반 픽셀씩 밀려 칸 사이에 빈틈이 생긴다.
        edgeX.push(x + 0.5);
        edgeY.push(y + 0.5);
      }

      // 4-이웃으로 묶는다. 대각선까지 붙이면 가까운 칸 두 개가 하나로 합쳐질 수 있다.
      for (const n of [left, right, up, down]) {
        if (joins(n) && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }

    if (area < minArea) {
      tooSmall++;
      continue;
    }

    const rect = minAreaRect(edgeX, edgeY);
    const fillRatio = area / (rect.w * rect.h);
    if (fillRatio < options.minFillRatio) {
      notRectangular++;
      if (bestRejectedFillRatio === null || fillRatio > bestRejectedFillRatio) {
        bestRejectedFillRatio = fillRatio;
      }
      continue;
    }

    slots.push({ ...rect, fillRatio });
  }

  return {
    slots: sortForHumans(slots),
    report: {
      blackRatio: blackPixels / total,
      tooSmall,
      notRectangular,
      bestRejectedFillRatio,
    },
  };
}

/**
 * 점들을 감싸는 가장 작은 사각형 — 각도를 0.25° 씩 훑어 면적이 최소인 지점을 고른다.
 *
 * 이미지 모멘트로 주축을 구하는 방법이 더 짧지만, 정사각형에 가까운 칸에서는 대칭 때문에
 * 각도가 정해지지 않는다. 폴라로이드 프레임이 딱 그 경우라 훑는 쪽을 쓴다.
 * 외곽점만 쓰므로 180 스텝 × 수천 점 = 밀리초에 끝난다.
 *
 * 넘어오는 점은 **픽셀 중심**이므로, 픽셀이 차지하는 넓이만큼(사방 0.5px) 넓혀서 돌려준다.
 * 이걸 빼면 칸이 실제보다 1px 작아져서, 칸끼리 맞닿는 템플릿에 1px 틈이 생긴다.
 */
function minAreaRect(xs: number[], ys: number[]) {
  let best = { cx: 0, cy: 0, w: 0, h: 0, angle: 0 };
  let bestArea = Number.POSITIVE_INFINITY;

  for (let deg = 0; deg < 90; deg += 0.25) {
    const angle = (deg * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let minU = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < xs.length; i++) {
      // 점을 -angle 만큼 돌려 축에 맞춘 뒤 범위를 잰다
      const u = xs[i] * cos + ys[i] * sin;
      const v = -xs[i] * sin + ys[i] * cos;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    // 사방 0.5px — 점이 픽셀 중심이라 양끝 픽셀의 바깥 절반이 빠져 있다
    const w = maxU - minU + 1;
    const h = maxV - minV + 1;
    const area = w * h;
    if (area >= bestArea) continue;

    // 회전 좌표계의 중심을 원래 좌표계로 되돌린다
    const cu = (minU + maxU) / 2;
    const cv = (minV + maxV) / 2;
    bestArea = area;
    best = {
      cx: cu * cos - cv * sin,
      cy: cu * sin + cv * cos,
      w,
      h,
      angle,
    };
  }

  // 80° 기울어진 사각형은 -10° 기울어진 채 가로세로가 바뀐 것과 같다.
  // 사람이 읽기 쉽도록 (-45°, 45°] 로 맞춘다.
  if (best.angle > Math.PI / 4) {
    return {
      cx: best.cx,
      cy: best.cy,
      w: best.h,
      h: best.w,
      angle: best.angle - Math.PI / 2,
    };
  }
  return best;
}

/**
 * 사람이 기대하는 번호 순서 — 위에서 아래로, 같은 줄이면 왼쪽에서 오른쪽으로.
 * 픽셀 스캔 순서 그대로 두면 1번 칸이 엉뚱한 곳이 된다.
 */
function sortForHumans(slots: Slot[]): Slot[] {
  return [...slots].sort((a, b) => {
    const overlap =
      Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
    const sameRow = overlap > Math.min(a.h, b.h) / 2;
    return sameRow ? a.cx - b.cx : a.cy - b.cy;
  });
}

/**
 * 사진 자리를 투명하게 뚫는다 (data 를 직접 고친다).
 * 이래야 사진을 아래에 깔고 템플릿을 위에 덮을 수 있다 — 안 뚫으면 검정이 사진을 가린다.
 *
 * **검정이면서 동시에 칸 안에 있는** 픽셀만 뚫는다. 색만 보고 전체를 뚫으면
 * 프레임 사이의 짙은 그림자까지 투명해져서, 그 자리로 아래 사진이 비쳐 나온다.
 * 반대로 칸 안이라고 무조건 뚫으면, 위에 겹친 프레임의 흰 판에 구멍이 뚫린다
 * (가려진 칸의 사각형은 그 판 아래까지 뻗어 있다). 두 조건을 모두 봐야 한다.
 */
export function punchSlots(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  slots: Slot[],
  threshold: number,
): void {
  for (const slot of slots) {
    const cos = Math.cos(slot.angle);
    const sin = Math.sin(slot.angle);

    // 기울어진 사각형을 감싸는 축 정렬 범위만 훑는다 (전체 이미지를 돌 필요가 없다)
    const reachX = (Math.abs(slot.w * cos) + Math.abs(slot.h * sin)) / 2;
    const reachY = (Math.abs(slot.w * sin) + Math.abs(slot.h * cos)) / 2;
    const minX = Math.max(0, Math.floor(slot.cx - reachX));
    const maxX = Math.min(width - 1, Math.ceil(slot.cx + reachX));
    const minY = Math.max(0, Math.floor(slot.cy - reachY));
    const maxY = Math.min(height - 1, Math.ceil(slot.cy + reachY));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // 칸 로컬 좌표로 되돌려 사각형 안인지 본다
        const dx = x - slot.cx;
        const dy = y - slot.cy;
        const u = dx * cos + dy * sin;
        const v = -dx * sin + dy * cos;
        if (Math.abs(u) > slot.w / 2 || Math.abs(v) > slot.h / 2) continue;

        const p = (y * width + x) * 4;
        if (data[p] <= threshold && data[p + 1] <= threshold && data[p + 2] <= threshold) {
          data[p + 3] = 0;
        }
      }
    }
  }
}

/** 칸을 꽉 채우고 남는 쪽을 잘라내는 초기 크롭 (중앙 기준) */
export function coverCrop(slotW: number, slotH: number, photoW: number, photoH: number): Crop {
  const slotAspect = slotW / slotH;
  const photoAspect = photoW / photoH;
  // 사진이 칸보다 납작하면 좌우를, 길쭉하면 위아래를 자른다
  const w = photoAspect > slotAspect ? slotAspect / photoAspect : 1;
  const h = photoAspect > slotAspect ? 1 : photoAspect / slotAspect;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export type SlotFill = {
  photo: CanvasImageSource;
  photoW: number;
  photoH: number;
  crop: Crop;
};

/**
 * 합성 — 칸마다 사진을 clip 해서 그리고, 마지막에 템플릿을 한 번 덮는다.
 *
 * 템플릿이 맨 위로 가므로 프레임 테두리·그림자가 사진 위에 얹히고, 칸이 서로 겹치는
 * 템플릿에서도 순서가 자연스럽게 맞는다.
 */
export function drawCollage(
  ctx: CanvasRenderingContext2D,
  template: CanvasImageSource,
  templateW: number,
  templateH: number,
  slots: Slot[],
  fills: (SlotFill | null)[],
  scale = 1,
): void {
  ctx.clearRect(0, 0, templateW * scale, templateH * scale);

  // 큰 칸을 먼저 그린다. 캔버스 전체가 사진 자리인 템플릿처럼 한 칸이 다른 칸을 감싸면,
  // 칸 번호 순서대로 그릴 때 큰 칸이 앞 칸을 덮어써 엉뚱한 사진이 보인다.
  // 칸 번호(사진을 넣는 순서)는 그대로 두고 그리는 순서만 바꾼다.
  const backToFront = slots
    .map((_, index) => index)
    .sort((a, b) => slots[b].w * slots[b].h - slots[a].w * slots[a].h);

  backToFront.forEach((index) => {
    const slot = slots[index];
    const fill = fills[index];
    if (!fill) return;

    const w = slot.w * scale;
    const h = slot.h * scale;

    ctx.save();
    ctx.translate(slot.cx * scale, slot.cy * scale);
    ctx.rotate(slot.angle);
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    ctx.drawImage(
      fill.photo,
      fill.crop.x * fill.photoW,
      fill.crop.y * fill.photoH,
      fill.crop.w * fill.photoW,
      fill.crop.h * fill.photoH,
      -w / 2,
      -h / 2,
      w,
      h,
    );
    ctx.restore();
  });

  ctx.drawImage(template, 0, 0, templateW * scale, templateH * scale);
}

/** 검출 결과를 눈으로 확인하기 위한 칸 테두리·번호 */
export function drawSlotOutlines(ctx: CanvasRenderingContext2D, slots: Slot[], scale = 1): void {
  slots.forEach((slot, index) => {
    const w = slot.w * scale;
    const h = slot.h * scale;

    ctx.save();
    ctx.translate(slot.cx * scale, slot.cy * scale);
    ctx.rotate(slot.angle);

    ctx.strokeStyle = '#ff5a5f';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.rotate(-slot.angle);
    ctx.fillStyle = '#ff5a5f';
    const r = Math.max(14, 22 * scale);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(16, 26 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), 0, 1);
    ctx.restore();
  });
}
