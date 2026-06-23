/**
 * 測試 / 分析 harness（目標 #3）。全部走引擎 spinOnce（唯一真相），
 * 只在外層做「手動玩碰不到」的彙總：強制觸發、機制結果分佈、觸發間距、極端值、不變式。
 */
import {
  buildSampler, spinOnce, bucketIndex, BUCKET_LABELS, BET, taxonomyEntry,
  type GameDefinition, type Rng, type SpinResult,
} from "@slot/engine";

export interface Invariant { name: string; ok: boolean; detail: string }
export interface HistBin { v: number; count: number; pct: number }
export interface DetailStat { key: string; n: number; mean: number; min: number; max: number; hist: HistBin[] }
export interface FeatureAnalysis {
  id: string; label: string; type: string;
  triggers: number; triggerOneIn: number;
  winMean: number; winP50: number; winP90: number; winP99: number; winMax: number;
  winBuckets: { name: string; pct: number }[];
  details: DetailStat[];
}
export interface Analysis {
  spins: number; ms: number;
  rtp: number; hitRate: number; triggerOneIn: number; sd: number;
  maxWin: number; maxWinAtSpin: number;
  invariants: Invariant[];
  dry: { maxNoTrigger: number; medianGap: number; p90Gap: number; maxNoWin: number };
  rarity: { label: string; oneIn: number }[];
  features: FeatureAnalysis[];
  cascade?: { mean: number; max: number; hist: HistBin[] }; // 連消鏈長分佈（只有 cascade 遊戲有）
}

const pctile = (sorted: number[], p: number) => {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
};

function histOf(values: number[]): HistBin[] {
  const m = new Map<number, number>();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  if (m.size > 60) return []; // 太分散就不畫直方圖（用 min/max/mean）
  const n = values.length;
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([v, count]) => ({ v, count, pct: (count / n) * 100 }));
}

export function analyzeGame(game: GameDefinition, spins: number, rng: Rng, onProgress?: (d: number, t: number) => void): Analysis {
  const sampler = buildSampler(game, rng);
  const t0 = performance.now();

  let sumPay = 0, sumSq = 0, hits = 0, trig = 0, maxWin = 0, maxWinAtSpin = -1;
  // 不變式
  let negWin = 0, nanWin = 0, mismatch = 0; let firstMismatch = "";
  // 觸發間距 / 空轉
  let lastTrig = -1; const gaps: number[] = []; let curNoWin = 0, maxNoWin = 0;
  // 各機制：贏分陣列 + 明細累積
  const fWins: Record<string, number[]> = {};
  const fDetail: Record<string, Record<string, number[]>> = {};
  for (const f of game.features) { fWins[f.id] = []; fDetail[f.id] = {}; }
  // 大獎稀有度
  const thresholds = [10, 50, 100, 250];
  const overCount = thresholds.map(() => 0);
  const casSteps: number[] = []; // 連消鏈長（只有 cascade 遊戲收集）

  const pstep = Math.max(1, Math.floor(spins / 100));
  for (let i = 0; i < spins; i++) {
    const r: SpinResult = spinOnce(sampler, game, rng);
    sumPay += r.total; sumSq += r.total * r.total;
    if (r.total > 0) hits++;
    if (r.total > maxWin) { maxWin = r.total; maxWinAtSpin = i; }
    // 不變式
    if (r.total < 0) negWin++;
    if (!Number.isFinite(r.total)) nanWin++;
    if (Math.abs(r.total - (r.base + r.feature)) > 1e-9) { mismatch++; if (!firstMismatch) firstMismatch = `局#${i}: total=${r.total} base+feat=${r.base + r.feature}`; }
    // 空轉串
    if (r.total > 0) { curNoWin = 0; } else { curNoWin++; if (curNoWin > maxNoWin) maxNoWin = curNoWin; }
    // 大獎稀有度
    for (let t = 0; t < thresholds.length; t++) if (r.total / BET >= thresholds[t]) overCount[t]++;
    if (game.cascade) casSteps.push(r.cascadeSteps);
    // 觸發
    if (r.triggered) {
      trig++;
      if (lastTrig >= 0) gaps.push(i - lastTrig);
      lastTrig = i;
      for (const id in r.perFeature) {
        if (fWins[id]) fWins[id].push(r.perFeature[id]);
        const det = r.perFeatureDetail[id];
        if (det) for (const k in det) { (fDetail[id][k] ||= []).push(det[k]); }
      }
    }
    if (onProgress && i % pstep === 0) onProgress(i, spins);
  }
  if (onProgress) onProgress(spins, spins);

  const mean = sumPay / spins;
  const sd = Math.sqrt(Math.max(sumSq / spins - mean * mean, 0));
  gaps.sort((a, b) => a - b);

  const features: FeatureAnalysis[] = game.features.map((f) => {
    const wins = (fWins[f.id] || []).slice().sort((a, b) => a - b);
    const wSum = wins.reduce((s, x) => s + x, 0);
    const buckets = new Array(BUCKET_LABELS.length).fill(0);
    for (const w of wins) buckets[bucketIndex(w / BET)]++;
    const details: DetailStat[] = Object.entries(fDetail[f.id] || {}).map(([key, arr]) => {
      const n = arr.length, s = arr.reduce((a, b) => a + b, 0);
      return { key, n, mean: n ? s / n : 0, min: n ? Math.min(...arr) : 0, max: n ? Math.max(...arr) : 0, hist: histOf(arr) };
    });
    return {
      id: f.id, label: f.label, type: f.type,
      triggers: wins.length, triggerOneIn: wins.length ? spins / wins.length : Infinity,
      winMean: wins.length ? wSum / wins.length : 0,
      winP50: pctile(wins, 50), winP90: pctile(wins, 90), winP99: pctile(wins, 99), winMax: wins.length ? wins[wins.length - 1] : 0,
      winBuckets: buckets.map((b, i) => ({ name: BUCKET_LABELS[i], pct: wins.length ? (b / wins.length) * 100 : 0 })),
      details,
    };
  });

  const invariants: Invariant[] = [
    { name: "贏分皆 ≥ 0", ok: negWin === 0, detail: negWin === 0 ? "OK" : `${negWin} 局出現負贏分` },
    { name: "贏分皆有限（無 NaN/∞）", ok: nanWin === 0, detail: nanWin === 0 ? "OK" : `${nanWin} 局出現 NaN/Infinity` },
    { name: "total = base + feature", ok: mismatch === 0, detail: mismatch === 0 ? "OK" : `${mismatch} 局不一致（${firstMismatch}）` },
  ];

  let casSum = 0, casMax = 0;
  for (const s of casSteps) { casSum += s; if (s > casMax) casMax = s; }
  const cascade = game.cascade
    ? { mean: casSteps.length ? casSum / casSteps.length : 0, max: casMax, hist: histOf(casSteps) }
    : undefined;

  return {
    spins, ms: Math.round(performance.now() - t0),
    rtp: sumPay / (spins * BET), hitRate: hits / spins, triggerOneIn: trig ? spins / trig : Infinity, sd,
    maxWin, maxWinAtSpin,
    invariants,
    dry: {
      maxNoTrigger: gaps.length ? gaps[gaps.length - 1] : spins,
      medianGap: pctile(gaps, 50), p90Gap: pctile(gaps, 90), maxNoWin,
    },
    rarity: thresholds.map((t, i) => ({ label: `≥ ${t}x`, oneIn: overCount[i] ? spins / overCount[i] : Infinity })),
    features,
    cascade,
  };
}

export interface ForceResult { found: boolean; tries: number; result: SpinResult | null }

/** 強制觸發：用引擎反覆抽，直到出現觸發局（手動等 1/136 太久，這裡幾百局內就有）。 */
export function forceTrigger(game: GameDefinition, rng: Rng, maxTries = 500000): ForceResult {
  const sampler = buildSampler(game, rng);
  for (let i = 0; i < maxTries; i++) {
    const r = spinOnce(sampler, game, rng);
    if (r.triggered) return { found: true, tries: i + 1, result: r };
  }
  return { found: false, tries: maxTries, result: null };
}

/**
 * 逐遊戲測試建議：讀 game 定義 + taxonomy 目錄，依三軸（贏分方式 / 玩法模式 / 遊戲機制）
 * 產出「這個遊戲該怎麼測」清單；每個分類條目自動帶入目錄的「怎麼測」指標（連動分類體系）。
 */
export function recommendTests(game: GameDefinition): string[] {
  const recs: string[] = [];
  recs.push("【基本】RTP 收斂曲線、波動 SD、中獎率 / 空轉率（→ 數值實驗室）。");
  recs.push("【不變式】贏分 ≥ 0、無 NaN/∞、total = base + feature、機制只在達門檻時計分。");

  // 贏分方式（pay 軸）
  const pay = taxonomyEntry(game.payMechanic ?? "ways");
  if (pay) recs.push(`【贏分方式·${pay.nameZH}】${pay.howToTest}`);

  // 玩法模式 / 遊戲機制（features）— 保留逐型別具體建議，再補目錄的指標參考。
  for (const f of game.features) {
    const axisLabel = f.category === "mechanic" ? "遊戲機制" : "玩法模式";
    if (f.type === "freeSpins") {
      recs.push(`【${axisLabel}·${f.label}】retrigger 鏈長分佈（會不會過長/失控）、平均免費局數、倍率 ×${f.params.multiplier ?? "?"} 對 RTP 的占比。`);
    } else if (f.type === "holdAndSpin") {
      recs.push(`【${axisLabel}·${f.label}】填滿盤面率（fullScreenBonus 對 RTP 占比）、觸發後金幣數分佈、重抽輪數、最大贏分來自哪種組合。`);
    } else {
      recs.push(`【${axisLabel}·${f.label}】(${f.type}) 觸發率、贏分分佈、最大值與邊界行為。`);
    }
    const tk = f.taxonomyKey ? taxonomyEntry(f.taxonomyKey) : undefined;
    if (tk) recs.push(`　↳ 指標參考（${tk.nameEN}）：${tk.howToTest}`);
    if (f.params && f.params.retrigger) recs.push(`　↳「${f.label}」可再觸發 → 特別測最長鏈與是否可能無限增長（已有 guard 上限要驗）。`);
  }

  // 純機制（game.mechanics，未以 feature 實作者，如 cascade）
  for (const k of game.mechanics ?? []) {
    const e = taxonomyEntry(k);
    if (e) recs.push(`【遊戲機制·${e.nameZH}】${e.howToTest}`);
  }
  if (game.cascade) recs.push(`【連消】連鎖鏈長分佈與最長連鎖、倍率階梯 ${game.cascade.multipliers.join("→")} 對 RTP 的放大幅度、是否有過長連鎖造成失控大獎。`);

  if (game.features.length > 0) recs.push("【體感】觸發間距：玩家最久要空轉幾局才進 bonus（影響體感與留存）。");
  recs.push("【極端值】最大單局贏分與其稀有度；目前未設封頂（win cap）→ 確認大獎不會失控。");
  return recs;
}
