import { Logger } from '@nestjs/common';
import { getHeapStatistics } from 'node:v8';

/**
 * 컨테이너 메모리 실사용량을 주기적으로 찍는다.
 *
 * 클라우드타입 구독은 메모리 할당량으로 과금되는데(0.25GB 단위), 대시보드는
 * "할당 512MB / 512MB" 처럼 **구독량**만 보여 줄 뿐 실제로 얼마를 쓰는지는 알려 주지 않는다.
 * 그래서 얼마를 구독해야 맞는지 추측만 하게 된다 — 이 로그가 그 추측을 숫자로 바꾼다.
 *
 * 보는 법:
 * - `rss` 가 컨테이너가 실제로 점유한 양이다. 구독량은 **peakRss** 기준으로 잡아야 한다
 *   (컨테이너는 평균이 아니라 순간 최대치에서 OOM 으로 죽는다).
 * - `heapLimit` 은 `NODE_OPTIONS=--max-old-space-size` 가 먹었는지 확인용이다.
 *   V8 이 old space 외 공간까지 더해 보고하므로 지정값보다 40~50MB 쯤 크게 나온다
 *   (320 → 368). 플래그가 안 먹으면 4000MB 근처가 찍히니 자릿수로 구분하면 된다.
 * - `external` 은 힙 밖 네이티브 메모리(Prisma 엔진, Buffer)라 max-old-space-size 로 못 막는다.
 *   rss 가 큰데 heap 이 작다면 범인은 대개 여기다.
 */

const MB = 1024 * 1024;
const toMb = (bytes: number) => Math.round((bytes / MB) * 10) / 10;

let peakRss = 0;
let peakHeapUsed = 0;

export interface MemorySnapshot {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
  peakRssMb: number;
  peakHeapUsedMb: number;
  heapLimitMb: number;
  uptimeSec: number;
}

/** 현재 메모리 상태를 MB 단위로 찍어 내고, 피크값을 갱신한다. */
export function memorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();

  peakRss = Math.max(peakRss, usage.rss);
  peakHeapUsed = Math.max(peakHeapUsed, usage.heapUsed);

  return {
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    externalMb: toMb(usage.external),
    peakRssMb: toMb(peakRss),
    peakHeapUsedMb: toMb(peakHeapUsed),
    heapLimitMb: toMb(getHeapStatistics().heap_size_limit),
    uptimeSec: Math.round(process.uptime()),
  };
}

/**
 * 부팅 직후 한 번, 이후 `intervalMs` 마다 메모리 한 줄을 로그로 남긴다.
 *
 * 타이머는 `unref()` 해 두므로 이 로거 때문에 프로세스가 종료를 못 하는 일은 없다
 * (`enableShutdownHooks()` 와 함께 돌아가야 한다).
 */
export function startMemoryLogger(intervalMs = 5 * 60_000): NodeJS.Timeout {
  const logger = new Logger('Memory');

  const tick = () => {
    const s = memorySnapshot();
    logger.log(
      `rss=${s.rssMb}MB (peak ${s.peakRssMb}MB) ` +
        `heap=${s.heapUsedMb}/${s.heapTotalMb}MB (peak ${s.peakHeapUsedMb}MB, limit ${s.heapLimitMb}MB) ` +
        `external=${s.externalMb}MB uptime=${s.uptimeSec}s`,
    );
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
}
