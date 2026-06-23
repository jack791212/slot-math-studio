/**
 * 模擬 harness（§3 架構圖裡「模擬 harness」那個盒子）。
 *
 * 它「重用」引擎的 per-spin 數學（spinOnce）與分桶（bucketIndex / BUCKET_LABELS），
 * 只在外層多做設計用的彙總：RTP 收斂取樣、各機制觸發次數、耗時。
 * 換言之：數學一律來自引擎，這裡不重寫任何運算（避免 §3 警告的數值漂移）。
 *
 * simulateRich 的核心聚合刻意與引擎 simulate 對齊；harness.test.ts 會以同一條
 * 種子斷言兩者數值一致，作為「harness 沒有漂移」的回歸保護。
 */
import {
  buildSampler, spinOnce, bucketIndex, BUCKET_LABELS, BET,
  type GameDefinition, type Rng,
} from "@slot/engine";
import type { RichSimResult } from "./types";

export function simulateRich(
  game: GameDefinition,
  spins: number,
  rng: Rng,
  onProgress?: (done: number, total: number) => void,
): RichSimResult {
  const sampler = buildSampler(game, rng);
  let sumPay = 0, sumBase = 0, sumFeat = 0, sumSq = 0, hits = 0, trig = 0, maxWin = 0;
  const perFeatureSum: Record<string, number> = {};
  const perFeatureTrig: Record<string, number> = {};
  const buckets = new Array(8).fill(0);
  const conv: { n: number; rtp: number }[] = [];
  const cstep = Math.max(1, Math.floor(spins / 120)); // 收斂曲線取樣間隔
  const pstep = Math.max(1, Math.floor(spins / 100)); // 進度回報間隔（~每 1%）
  const t0 = performance.now();

  for (let i = 0; i < spins; i++) {
    const r = spinOnce(sampler, game, rng);
    sumPay += r.total; sumBase += r.base; sumFeat += r.feature; sumSq += r.total * r.total;
    if (r.total > 0) hits++;
    if (r.triggered) trig++;
    if (r.total > maxWin) maxWin = r.total;
    for (const k in r.perFeature) {
      perFeatureSum[k] = (perFeatureSum[k] || 0) + r.perFeature[k];
      perFeatureTrig[k] = (perFeatureTrig[k] || 0) + 1;
    }
    buckets[bucketIndex(r.total / BET)]++;
    if (i % cstep === 0) conv.push({ n: i + 1, rtp: (sumPay / ((i + 1) * BET)) * 100 });
    if (onProgress && i % pstep === 0) onProgress(i, spins);
  }

  const mean = sumPay / spins;
  const sd = Math.sqrt(Math.max(sumSq / spins - mean * mean, 0));
  const perFeature: Record<string, number> = {};
  for (const k in perFeatureSum) perFeature[k] = perFeatureSum[k] / (spins * BET);
  if (onProgress) onProgress(spins, spins);

  return {
    spins,
    rtp: sumPay / (spins * BET),
    rtpBase: sumBase / (spins * BET),
    rtpFeat: sumFeat / (spins * BET),
    hitRate: hits / spins,
    triggerOneIn: trig ? spins / trig : Infinity,
    sd, se: sd / Math.sqrt(spins), maxWin, perFeature, perFeatureTrig,
    buckets: buckets.map((b, i) => ({ name: BUCKET_LABELS[i], pct: (b / spins) * 100, idx: i })),
    conv,
    ms: Math.round(performance.now() - t0),
  };
}

/** 玩家旅程：單一玩家的餘額曲線（同樣 RTP，每段體感差很多）。 */
export function runSession(
  game: GameDefinition,
  rng: Rng,
  startBal = 200,
  spins = 500,
): { spin: number; bal: number }[] {
  const sampler = buildSampler(game, rng);
  let bal = startBal;
  const data = [{ spin: 0, bal }];
  for (let i = 1; i <= spins; i++) {
    bal -= BET;
    bal += spinOnce(sampler, game, rng).total;
    data.push({ spin: i, bal: Math.max(bal, 0) });
    if (bal <= 0) break;
  }
  return data;
}
