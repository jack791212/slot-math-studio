/**
 * slot-engine — 已驗證的純引擎（無框架依賴）
 * ------------------------------------------------------------
 * 這是整個案子的「唯一真相」。試玩 UI、設計用模擬、上線認證模擬，
 * 全部應該共用這一份邏輯，不要各自重寫，否則數值會漂移。
 *
 * 模型：每軸符號權重 + RNG 抽盤面（5x3，243 ways）。可改為模擬輪帶表。
 * 簡化（皆為可拍板的旋鈕）：
 *   - WILD 只替代賠付符號，不另計自身賠付。
 *   - 每格獨立加權抽樣（非固定輪帶帶位）。
 *
 * 亂數「注入」：引擎不自帶亂數。
 *   - 設計用：傳 Math.random。
 *   - 測試 / 認證：傳可種子化 PRNG（下方 mulberry32）或密碼學等級 RNG。
 *
 * 決定性保證：同一份 game 定義 + 同一條 rng 序列 → 完全相同的結果。
 * 符號順序（game.symbols）是決定性契約的一部分，移植時不可更動順序。
 */

export type Rng = () => number; // 回傳 [0,1)
export type Board = string[][]; // board[reel][row]
export type Sampler = () => string;

export interface FeatureDef {
  id: string;
  type: string; // 對應 FEATURE_HANDLERS 的 key
  label: string;
  trigger: string; // 人類可讀的觸發條件描述（給規格書用）
  desc: string;
  params: Record<string, any>;
}

export interface GameDefinition {
  id: string;
  name: string;
  tagline: string;
  expectation: string;
  audience: string;
  volatilityTarget: string;
  rtpTarget: number;       // 目標 RTP（%）
  rtpTolerance: number;    // 容差（±%）
  layout: { reels: number; rows: number; model: string };
  symbols: string[];       // 全部符號（順序 = 抽樣權重的累積順序，屬決定性契約）
  paying: string[];        // 參與 ways 賠付的符號（依賠付優先序）
  wild: string;            // 百搭符號 id
  weights: Record<string, number>;        // 每個符號的權重點數（機率 = 權重 / 總和）
  paytable: Record<string, number[]>;     // 符號 -> [3連, 4連, 5連] 賠付（× 總押注）
  scatter: { symbol: string; pays: Record<number, number> }; // 散佈符號與其賠付（× 總押注）
  features: FeatureDef[];
}

export interface SimResult {
  spins: number;
  rtp: number;        // 0..1
  rtpBase: number;
  rtpFeat: number;
  hitRate: number;
  triggerOneIn: number;
  sd: number;         // 每局贏分標準差（單位 = × 押注）
  se: number;         // RTP 標準誤差
  maxWin: number;     // 最大單局贏分（× 押注）
  perFeature: Record<string, number>;     // 各機制對 RTP 的貢獻（0..1）
  buckets: { name: string; pct: number; idx: number }[];
}

const BET = 1; // 總押注基準單位；賠付表皆以「× 總押注」表示

/** 可種子化 PRNG（測試與認證用，跨環境決定性一致）。 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 依權重建立抽樣器；rng 由外部注入。 */
export function buildSampler(game: GameDefinition, rng: Rng): Sampler {
  const total = game.symbols.reduce((s, k) => s + (game.weights[k] || 0), 0);
  const cum: [string, number][] = [];
  let acc = 0;
  for (const k of game.symbols) { acc += game.weights[k] || 0; cum.push([k, acc / total]); }
  return () => {
    const r = rng();
    for (const [k, c] of cum) if (r < c) return k;
    return cum[cum.length - 1][0];
  };
}

export function drawBoard(sampler: Sampler, game: GameDefinition): Board {
  const b: Board = [];
  for (let c = 0; c < game.layout.reels; c++) {
    const col: string[] = [];
    for (let r = 0; r < game.layout.rows; r++) col.push(sampler());
    b.push(col);
  }
  return b;
}

export function countScatter(b: Board, game: GameDefinition): number {
  let n = 0;
  for (let c = 0; c < b.length; c++) for (let r = 0; r < b[c].length; r++) if (b[c][r] === game.scatter.symbol) n++;
  return n;
}

/** 243 ways 評分（快速版，模擬用）。 */
export function evalWays(b: Board, game: GameDefinition): number {
  let win = 0;
  for (const sym of game.paying) {
    const counts: number[] = [];
    for (let c = 0; c < b.length; c++) {
      let k = 0;
      for (let r = 0; r < b[c].length; r++) { const s = b[c][r]; if (s === sym || s === game.wild) k++; }
      if (k === 0) break;
      counts.push(k);
    }
    if (counts.length >= 3) {
      let w = 1; for (let i = 0; i < counts.length; i++) w *= counts[i];
      win += game.paytable[sym][counts.length - 3] * w;
    }
  }
  return win;
}

/** 詳細版：另回傳中獎格子座標（"c-r"），給試玩 UI 高亮用。 */
export function evalDetailed(b: Board, game: GameDefinition): { win: number; cells: Set<string> } {
  let win = 0; const cells = new Set<string>();
  for (const sym of game.paying) {
    const counts: number[] = [];
    for (let c = 0; c < b.length; c++) {
      let k = 0;
      for (let r = 0; r < b[c].length; r++) { const s = b[c][r]; if (s === sym || s === game.wild) k++; }
      if (k === 0) break;
      counts.push(k);
    }
    if (counts.length >= 3) {
      let w = 1; for (let i = 0; i < counts.length; i++) w *= counts[i];
      win += game.paytable[sym][counts.length - 3] * w;
      for (let c = 0; c < counts.length; c++) for (let r = 0; r < b[c].length; r++) { const s = b[c][r]; if (s === sym || s === game.wild) cells.add(c + "-" + r); }
    }
  }
  return { win, cells };
}

/**
 * 機制模組登錄表。新增機制 = 在這裡註冊一個 type。
 * 簽名：(sampler, params, game) => (triggerCount) => 該機制贏分（× 押注）
 */
export const FEATURE_HANDLERS: Record<string, (sampler: Sampler, params: any, game: GameDefinition) => (count: number) => number> = {
  freeSpins: (sampler, params, game) => (count) => {
    let total = 0;
    let remaining = params.award[Math.min(count, 5)];
    let guard = 0;
    while (remaining > 0 && guard < 20000) {
      guard++; remaining--;
      const b = drawBoard(sampler, game);
      total += evalWays(b, game) * params.multiplier;
      const sc = countScatter(b, game);
      if (sc >= 3) {
        total += (game.scatter.pays[Math.min(sc, 5)] || 0) * params.multiplier;
        if (params.retrigger) remaining += params.award[Math.min(sc, 5)];
      }
    }
    return total;
  },
  // 待加：stickyWild、holdAndSpin（重抽）、cascade（連消）、progressiveJackpot …
};

export interface SpinResult {
  base: number; feature: number; total: number;
  perFeature: Record<string, number>; triggered: boolean;
}

export function spinOnce(sampler: Sampler, game: GameDefinition): SpinResult {
  const b = drawBoard(sampler, game);
  let base = evalWays(b, game);
  let feature = 0;
  const perFeature: Record<string, number> = {};
  const sc = countScatter(b, game);
  if (sc >= 3) {
    base += game.scatter.pays[Math.min(sc, 5)] || 0;
    for (const f of game.features) {
      const handler = FEATURE_HANDLERS[f.type];
      if (!handler) continue;
      const w = handler(sampler, f.params, game)(sc);
      perFeature[f.id] = (perFeature[f.id] || 0) + w;
      feature += w;
    }
  }
  return { base, feature, total: base + feature, perFeature, triggered: sc >= 3 };
}

const BUCKET_LABELS = ["0x", "0-1x", "1-2x", "2-5x", "5-10x", "10-50x", "50-100x", "100x+"];
function bucketIndex(x: number): number {
  if (x <= 0) return 0; if (x < 1) return 1; if (x < 2) return 2; if (x < 5) return 3;
  if (x < 10) return 4; if (x < 50) return 5; if (x < 100) return 6; return 7;
}

/**
 * 參考模擬（reference simulation）。
 * 認證級可把這段同樣邏輯丟進 Worker / Node / 或移植到 Rust 跑數千萬～數十億局，
 * 並用下方黃金基準值驗證移植正確。
 */
export function simulate(game: GameDefinition, spins: number, rng: Rng): SimResult {
  const sampler = buildSampler(game, rng);
  let sumPay = 0, sumBase = 0, sumFeat = 0, sumSq = 0, hits = 0, trig = 0, maxWin = 0;
  const perFeatureSum: Record<string, number> = {};
  const buckets = new Array(8).fill(0);
  for (let i = 0; i < spins; i++) {
    const r = spinOnce(sampler, game);
    sumPay += r.total; sumBase += r.base; sumFeat += r.feature; sumSq += r.total * r.total;
    if (r.total > 0) hits++;
    if (r.triggered) trig++;
    if (r.total > maxWin) maxWin = r.total;
    for (const k in r.perFeature) perFeatureSum[k] = (perFeatureSum[k] || 0) + r.perFeature[k];
    buckets[bucketIndex(r.total / BET)]++;
  }
  const mean = sumPay / spins;
  const sd = Math.sqrt(Math.max(sumSq / spins - mean * mean, 0));
  const perFeature: Record<string, number> = {};
  for (const k in perFeatureSum) perFeature[k] = perFeatureSum[k] / (spins * BET);
  return {
    spins,
    rtp: sumPay / (spins * BET),
    rtpBase: sumBase / (spins * BET),
    rtpFeat: sumFeat / (spins * BET),
    hitRate: hits / spins,
    triggerOneIn: trig ? spins / trig : Infinity,
    sd, se: sd / Math.sqrt(spins), maxWin, perFeature,
    buckets: buckets.map((b, i) => ({ name: BUCKET_LABELS[i], pct: (b / spins) * 100, idx: i })),
  };
}

/** 範例遊戲定義（symbols 順序屬決定性契約，勿改）。 */
export const DEFAULT_GAME: GameDefinition = {
  id: "demo-243",
  name: "範例 · 烈焰 243",
  tagline: "中高波動，免費遊戲扛起四成 RTP — 主打「進 bonus」的期待感。",
  expectation: "湊滿 3 個散佈進免費遊戲，×8 倍率把小獎放大成大獎。",
  audience: "願意忍受空轉、為大獎而玩、會追 bonus 的玩家。",
  volatilityTarget: "中高（High-Med）",
  rtpTarget: 95.0,
  rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways" },
  symbols: ["WILD", "SCAT", "H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  paying: ["H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  wild: "WILD",
  weights: { WILD: 3, SCAT: 3.5, H1: 7, H2: 9, H3: 11, L1: 20, L2: 22, L3: 24, L4: 26 },
  paytable: {
    H1: [0.75, 3.3, 16.5], H2: [0.45, 2.0, 8.8], H3: [0.28, 1.1, 4.4],
    L1: [0.11, 0.39, 1.3], L2: [0.09, 0.33, 1.1], L3: [0.055, 0.22, 0.77], L4: [0.045, 0.165, 0.55],
  },
  scatter: { symbol: "SCAT", pays: { 3: 2.2, 4: 8.8, 5: 44 } },
  features: [
    {
      id: "freeGames", type: "freeSpins", label: "免費遊戲",
      trigger: "盤面 3+ 散佈", desc: "贈送免費局並對所有贏分套用固定倍率，期間 3+ 散佈可再觸發。",
      params: { award: { 3: 10, 4: 15, 5: 25 }, multiplier: 8, retrigger: true },
    },
  ],
};

/**
 * 黃金基準值（回歸契約）— DEFAULT_GAME，mulberry32(12345)，2,000,000 局。
 * 移植 / 重構引擎後，下方 GOLDEN.rtp 必須完全相等（決定性，不是「接近」）。
 * 測試範例（Vitest/Jest）：
 *   const r = simulate(DEFAULT_GAME, 2_000_000, mulberry32(12345));
 *   expect(r.rtp).toBeCloseTo(GOLDEN.rtp, 8);
 */
export const GOLDEN = {
  seed: 12345,
  spins: 2_000_000,
  prng: "mulberry32",
  rtp: 0.94958201,
  rtpBase: 0.55743229,
  rtpFeat: 0.39214972,
  featureShare: 0.41297, // rtpFeat / rtp
  hitRate: 0.47655750,
  triggerOneIn: 129.4415,
  sd: 6.846332,
  maxWin: 1195.805,
  perFeature: { freeGames: 0.39214972 },
} as const;
