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
 *
 * ── 接手備註（與原始 slot-engine.ts 的唯一差異）──────────────────
 * 本檔由 HANDOFF 的 slot-engine.ts 原樣搬入，僅對三個原本為 module-private
 * 的輔助項加上 `export`（BET、BUCKET_LABELS、bucketIndex），讓 studio 的
 * 模擬 harness 能「重用」引擎的分桶邏輯，而非自行重寫（避免漂移）。
 * 沒有更動任何運算、符號順序或 simulate 的內容；§6 黃金測試守住數值不變。
 */

export * from "./taxonomy";

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
  /** 觸發此機制要數的符號；可單一或多個（如 hold&spin 的各種金幣）。預設 = scatter.symbol。 */
  triggerSymbol?: string | string[];
  /** 觸發門檻（盤面上 triggerSymbol 的數量需 ≥ 此值）。預設 = 3。 */
  triggerMin?: number;
  /** 三軸分類：此 feature 屬「玩法模式 mode」或「遊戲機制 mechanic」（給 UI 分區與規格書用）。 */
  category?: "mode" | "mechanic";
  /** 對應 taxonomy 目錄的 key（分類百科交叉引用，如 "freeSpins" / "holdAndSpin" / "stickyWild"）。 */
  taxonomyKey?: string;
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
  /** 連消（cascade / avalanche）：有設定就啟用，base 改為連消結算。multipliers = 連續第 n 次連消的倍率（超過陣列長度沿用最後一個）。 */
  cascade?: { multipliers: number[] };
  /** 贏分方式（taxonomy「pay」軸的 key，如 "ways" / "cluster" / "scatterPays"）。未設 = "ways"（既有行為，守黃金值）。 */
  payMechanic?: string;
  /** 此遊戲用到、但未以 feature handler 實作的「遊戲機制」（taxonomy「mechanic」軸 key，如 "cascade"），供分類顯示。 */
  mechanics?: string[];
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

export const BET = 1; // 總押注基準單位；賠付表皆以「× 總押注」表示

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

/** 數盤面上某個符號的數量。 */
export function countSymbol(b: Board, symbol: string): number {
  let n = 0;
  for (let c = 0; c < b.length; c++) for (let r = 0; r < b[c].length; r++) if (b[c][r] === symbol) n++;
  return n;
}

/** 數盤面上一組符號（任一）的總數量。 */
export function countSymbols(b: Board, symbols: string[]): number {
  let n = 0;
  for (const s of symbols) n += countSymbol(b, s);
  return n;
}

export function countScatter(b: Board, game: GameDefinition): number {
  return countSymbol(b, game.scatter.symbol);
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
 * Cascade（連消 / avalanche）結算：有中獎就移除中獎符號、補上新符號、重算，
 * 連續中獎倍率依 game.cascade.multipliers 遞增（超過陣列長度沿用最後一個）。
 * 注意：243 ways 與符號在 reel 內的位置無關，所以「就地補新符號」對賠付而言
 * 與「掉落填補（gravity）」完全等價 —— 引擎用前者，演出層可做掉落動畫。
 */
/** 把一組中獎格（"c-r"）就地補上新抽的符號（連消用）。 */
export function refillCells(board: Board, cells: Set<string>, sampler: Sampler): void {
  for (const cr of cells) { const i = cr.indexOf("-"); board[+cr.slice(0, i)][+cr.slice(i + 1)] = sampler(); }
}

export function cascadeBase(initial: Board, game: GameDefinition, sampler: Sampler): { win: number; steps: number } {
  const mult = game.cascade!.multipliers;
  const board: Board = initial.map((col) => col.slice());
  let total = 0, step = 0, guard = 0;
  while (guard++ < 200) {
    const { win, cells } = evalDetailed(board, game);
    if (win <= 0) break;
    total += win * mult[Math.min(step, mult.length - 1)];
    step++;
    refillCells(board, cells, sampler);
  }
  return { win: total, steps: step };
}

/** 贏分方式單次結算結果（給 PAY_MECHANICS 用）。cells = 中獎格座標（試玩高亮 / cascade 用）。 */
export interface PayResult { win: number; steps: number; cells?: Set<string> }

/**
 * 贏分方式（pay mechanic）登錄表 — base 如何結算的「另一條擴充軸」（與 cascade 同層級）。
 * 簽名：(board, game, sampler) => { win, steps, cells? }
 *   - "ways"（預設 / 未設 payMechanic）不在此表：走既有 evalWays / cascade 路徑（守黃金值，不可動）。
 *   - 新贏分方式（cluster 集合連爆 / scatterPays 分散連爆 …）在此註冊一個 key，並在 game.payMechanic 指定。
 *   - steps = 連消 / 連鎖次數（無則 0），供測試工具收集 cascadeSteps。
 */
export const PAY_MECHANICS: Record<string, (board: Board, game: GameDefinition, sampler: Sampler) => PayResult> = {};

/**
 * 機制模組登錄表。新增機制 = 在這裡註冊一個 type。
 * 簽名：(sampler, params, game, board, rng) => (triggerCount) => 該機制贏分（× 押注）
 *   - sampler：依主遊戲權重抽符號（與下面的 rng 同一條注入序列，保證決定性）。
 *   - board：觸發當下的盤面（hold&spin 需要知道起始金幣位置/面額）。
 *   - rng：原始亂數，給需要「與主遊戲權重脫鉤」的機制用（如 hold&spin 的重抽落幣機率）。
 */
/** 機制單次結果：贏分 + 可選的結構化明細（給測試工具看「手動跑不出來」的內部狀態）。 */
export interface FeatureResult {
  win: number;
  detail?: Record<string, number>;
}

export const FEATURE_HANDLERS: Record<string, (sampler: Sampler, params: any, game: GameDefinition, board: Board, rng: Rng) => (count: number) => FeatureResult> = {
  freeSpins: (sampler, params, game, _board, _rng) => (count) => {
    let total = 0;
    let remaining = params.award[Math.min(count, 5)];
    let guard = 0;
    let played = 0, retriggers = 0;
    while (remaining > 0 && guard < 20000) {
      guard++; remaining--; played++;
      const b = drawBoard(sampler, game);
      total += evalWays(b, game) * params.multiplier;
      const sc = countScatter(b, game);
      if (sc >= 3) {
        total += (game.scatter.pays[Math.min(sc, 5)] || 0) * params.multiplier;
        if (params.retrigger) { remaining += params.award[Math.min(sc, 5)]; retriggers++; }
      }
    }
    return { win: total, detail: { spins: played, retriggers } };
  },

  /**
   * Hold & Spin（金幣鎖定 / 收集）。
   *   - 觸發：盤面 ≥ triggerMin 枚金幣（金幣符號見 triggerSymbol）。
   *   - 起始金幣面額由「金幣符號身分」決定（params.coins: 符號 -> 面額×押注）。
   *   - 重抽：只重抽空格，每格以 params.respinCoinChance 機率落新金幣（與主遊戲密度脫鉤，
   *     才不會「要嘛填滿、要嘛幾乎不觸發」的懸崖效應）；新金幣面額依金幣符號權重比抽。
   *   - 每一輪有新幣落下就把重抽次數歸位為 params.respins；用盡或填滿盤面結束。
   *   - 贏分 = 所有鎖定金幣面額總和（填滿 15 格再加 params.fullScreenBonus）。
   */
  holdAndSpin: (_sampler, params, game, board, rng) => () => {
    const coins: Record<string, number> = params.coins;
    const totalCells = game.layout.reels * game.layout.rows;
    const p: number = params.respinCoinChance;

    // 重抽落幣的面額分佈：用金幣符號的權重比（單一來源，與起始金幣一致）。
    const cum: [number, number][] = [];
    const coinSyms = Object.keys(coins);
    let totW = 0;
    for (const s of coinSyms) totW += game.weights[s] || 0;
    let acc = 0;
    for (const s of coinSyms) { acc += (game.weights[s] || 0) / totW; cum.push([coins[s], acc]); }
    const drawCoinValue = (): number => {
      const r = rng();
      for (const [v, c] of cum) if (r < c) return v;
      return cum[cum.length - 1][0];
    };

    // 起始金幣（觸發盤面上的）
    const lockedValues: number[] = [];
    for (let c = 0; c < board.length; c++) for (let r = 0; r < board[c].length; r++) {
      const v = coins[board[c][r]];
      if (v !== undefined) lockedValues.push(v);
    }
    let locked = lockedValues.length;
    let respins = params.respins;
    let rounds = 0;
    while (respins > 0 && locked < totalCells) {
      rounds++;
      const empty = totalCells - locked;
      let landed = 0;
      for (let i = 0; i < empty; i++) {
        if (rng() < p) { lockedValues.push(drawCoinValue()); landed++; }
      }
      locked += landed;
      if (landed > 0) respins = params.respins; else respins--;
    }
    let total = 0;
    for (const v of lockedValues) total += v;
    const full = locked >= totalCells ? 1 : 0;
    if (full && params.fullScreenBonus) total += params.fullScreenBonus;
    return { win: total, detail: { coins: locked, full, rounds } };
  },

  /**
   * 連消免費遊戲（cascade + free spins 疊加）：免費局內每局都連消，
   * 但倍率 gm 是「全程累積、不重置」（每次連消 +multStep）——Sweet Bonanza 式的越滾越大。
   * 搭配 base 也有 cascade 的遊戲使用（base 用階梯倍率且每局重置；免費局用這個全程倍率）。
   */
  freeSpinsCascade: (sampler, params, game, _board, _rng) => (count) => {
    let total = 0, remaining = params.award[Math.min(count, 5)], guard = 0, played = 0, retriggers = 0;
    let gm = params.startMult ?? 1;
    const inc = params.multStep ?? 1;
    while (remaining > 0 && guard < 20000) {
      guard++; remaining--; played++;
      const b = drawBoard(sampler, game);
      let cguard = 0;
      while (cguard++ < 200) {
        const { win, cells } = evalDetailed(b, game);
        if (win <= 0) break;
        total += win * gm;
        gm += inc;
        refillCells(b, cells, sampler);
      }
      const sc = countScatter(b, game);
      if (sc >= 3 && params.retrigger) { remaining += params.award[Math.min(sc, 5)]; retriggers++; }
    }
    return { win: total, detail: { spins: played, retriggers, endMult: gm } };
  },

  /**
   * 黏性百搭（sticky wild）：觸發後給 respins 次重抽；每次重抽落下的 WILD 會「鎖定」
   * 並保留到結束（越積越多 → ways 贏分越大）；落到新 WILD 就把重抽歸位。
   */
  stickyWild: (sampler, params, game, _board, _rng) => () => {
    const respinsMax: number = params.respins;
    const reels = game.layout.reels, rows = game.layout.rows;
    const locked = new Set<string>();
    let total = 0, respins = respinsMax, guard = 0, played = 0;
    while (respins > 0 && guard < 1000) {
      guard++; respins--; played++;
      const b = drawBoard(sampler, game);
      for (const cr of locked) { const i = cr.indexOf("-"); b[+cr.slice(0, i)][+cr.slice(i + 1)] = game.wild; }
      let newWild = 0;
      for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) { const k = c + "-" + r; if (b[c][r] === game.wild && !locked.has(k)) { locked.add(k); newWild++; } }
      total += evalWays(b, game);
      // 固定重抽次數、不因新 WILD 歸位 → wild 累積有上限，避免盤面填滿造成天文數字贏分。
    }
    return { win: total, detail: { wilds: locked.size, spins: played } };
  },

  /**
   * 漸進式頭獎（progressive jackpot）：觸發後依權重抽一個 tier（mini/minor/major/grand），回傳該 tier 面額。
   * 註：此處 tier 面額為固定值（代表平均派彩）。真實「成長式 pot」需跨局狀態（每局提撥、中獎清零），
   *     屬生產層的會計，不在本純函式引擎內模擬。
   */
  jackpot: (_sampler, params, game, _board, rng) => () => {
    const tiers: { value: number; weight: number }[] = params.tiers;
    let tot = 0; for (const t of tiers) tot += t.weight;
    let r = rng() * tot, idx = tiers.length - 1;
    for (let i = 0; i < tiers.length; i++) { r -= tiers[i].weight; if (r < 0) { idx = i; break; } }
    return { win: tiers[idx].value, detail: { tier: idx } };
  },
};

export interface SpinResult {
  base: number; feature: number; total: number;
  perFeature: Record<string, number>; triggered: boolean;
  /** 各機制本局的結構化明細（如 hold&spin 的 coins/full/rounds）。模擬用不到，測試工具用。 */
  perFeatureDetail: Record<string, Record<string, number>>;
  /** 本局連消次數（無 cascade 的遊戲為 0）。測試工具用。 */
  cascadeSteps: number;
}

export function spinOnce(sampler: Sampler, game: GameDefinition, rng: Rng): SpinResult {
  const b = drawBoard(sampler, game);
  // base 結算：① payMechanic 為非 "ways" 且已註冊 → 走該贏分方式；② 否則有 cascade 走連消；③ 否則一般 243 ways。
  // （既有 6 個遊戲皆 payMechanic="ways" → 落在 ②/③，與改動前完全一致，守黃金值。）
  let base: number, cascadeSteps = 0;
  const pm = game.payMechanic;
  if (pm && pm !== "ways" && PAY_MECHANICS[pm]) { const r = PAY_MECHANICS[pm](b, game, sampler); base = r.win; cascadeSteps = r.steps; }
  else if (game.cascade) { const cas = cascadeBase(b, game, sampler); base = cas.win; cascadeSteps = cas.steps; }
  else base = evalWays(b, game);
  let feature = 0;
  const perFeature: Record<string, number> = {};
  const perFeatureDetail: Record<string, Record<string, number>> = {};

  // 散佈符號的基礎賠付（主遊戲的一部分，與是否觸發機制無關）。
  const sc = countScatter(b, game);
  if (sc >= 3) base += game.scatter.pays[Math.min(sc, 5)] || 0;

  // 每個機制依自己宣告的觸發符號 / 門檻判定。
  let triggered = false;
  for (const f of game.features) {
    const handler = FEATURE_HANDLERS[f.type];
    if (!handler) continue;
    const trig = f.triggerSymbol ?? game.scatter.symbol;
    const syms = Array.isArray(trig) ? trig : [trig];
    const min = f.triggerMin ?? 3;
    const cnt = countSymbols(b, syms);
    if (cnt >= min) {
      const res = handler(sampler, f.params, game, b, rng)(cnt);
      perFeature[f.id] = (perFeature[f.id] || 0) + res.win;
      if (res.detail) perFeatureDetail[f.id] = res.detail;
      feature += res.win;
      triggered = true;
    }
  }
  return { base, feature, total: base + feature, perFeature, perFeatureDetail, triggered, cascadeSteps };
}

export const BUCKET_LABELS = ["0x", "0-1x", "1-2x", "2-5x", "5-10x", "10-50x", "50-100x", "100x+"];
export function bucketIndex(x: number): number {
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
    const r = spinOnce(sampler, game, rng);
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
  payMechanic: "ways",
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
      category: "mode", taxonomyKey: "freeSpins",
      trigger: "盤面 3+ 散佈", desc: "贈送免費局並對所有贏分套用固定倍率，期間 3+ 散佈可再觸發。",
      params: { award: { 3: 10, 4: 15, 5: 25 }, multiplier: 8, retrigger: true },
    },
  ],
};

/**
 * 範例 · Hold & Spin（金幣鎖定 / 收集）。
 * 金幣有多種面額符號（C1/C2/C5/CT/CG），面額分佈由其權重決定。
 * symbols 順序屬決定性契約，勿改。數值已用引擎模擬調校到 RTP≈目標帶內。
 */
export const HOLD_SPIN_GAME: GameDefinition = {
  id: "demo-holdspin",
  name: "範例 · 黃金 Hold & Spin",
  tagline: "收集金幣、鎖定不走、3 次重抽歸零，填滿盤面奪頂獎 — 主打『再一次』的收集快感。",
  expectation: "盤面湊滿 6 枚金幣觸發 Hold & Spin；金幣鎖定，落新幣就把重抽歸位為 3。",
  audience: "喜歡收集、緊盯每一轉、為頂獎而玩的玩家。",
  volatilityTarget: "高（High）",
  rtpTarget: 95.0,
  rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways + Hold&Spin" },
  payMechanic: "ways",
  symbols: ["WILD", "H1", "H2", "H3", "L1", "L2", "L3", "L4", "C1", "C2", "C5", "CT", "CG"],
  paying: ["H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  wild: "WILD",
  weights: { WILD: 4, H1: 8, H2: 10, H3: 12, L1: 20, L2: 22, L3: 24, L4: 26, C1: 10, C2: 4.5, C5: 2.2, CT: 1.1, CG: 0.45 },
  paytable: {
    H1: [0.8, 3.5, 18], H2: [0.5, 2.2, 9], H3: [0.3, 1.2, 4.6],
    L1: [0.12, 0.4, 1.4], L2: [0.1, 0.34, 1.1], L3: [0.06, 0.24, 0.8], L4: [0.05, 0.18, 0.6],
  },
  scatter: { symbol: "SCAT", pays: {} }, // 此遊戲不使用散佈（保留欄位）
  features: [
    {
      id: "holdSpin", type: "holdAndSpin", label: "Hold & Spin（金幣鎖定）",
      category: "mode", taxonomyKey: "holdAndSpin",
      trigger: "盤面 6+ 金幣",
      triggerSymbol: ["C1", "C2", "C5", "CT", "CG"],
      triggerMin: 6,
      desc: "金幣鎖定並給 3 次重抽；每落一枚新金幣就把重抽歸位為 3，重抽用盡或填滿盤面結束。贏分 = 所有金幣面額總和，填滿 15 格再加頂獎。",
      params: {
        respins: 3,
        respinCoinChance: 0.193,                         // 重抽時每空格落金幣的機率（與主遊戲密度脫鉤）
        coins: { C1: 1, C2: 2, C5: 5, CT: 10, CG: 30 },  // 面額（× 押注）
        fullScreenBonus: 100,                            // 填滿盤面額外加（× 押注）
      },
    },
  ],
};

/**
 * 範例 · 連消寶石（cascade / avalanche）。
 * 沒有觸發式機制；base 走連消結算，連續中獎倍率 1→2→3→5 遞增（每局重置）。
 * 賠付刻意偏低（連消會放大），數值已用引擎模擬調校到目標帶內。symbols 順序屬決定性契約。
 */
export const CASCADE_GAME: GameDefinition = {
  id: "demo-cascade",
  name: "範例 · 連消寶石",
  tagline: "中獎即連消、連鎖倍率 1→2→3→5 遞增 — 一次轉動可能連環爆。",
  expectation: "中獎符號消除、新符號補入、再算一次；連得越多倍率越高。",
  audience: "喜歡連鎖、小獎不斷、追連環爆的玩家。",
  volatilityTarget: "中（High-Med，靠連鎖放大）",
  rtpTarget: 95.0,
  rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways · Cascade" },
  payMechanic: "ways",
  mechanics: ["cascade"],
  symbols: ["WILD", "H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  paying: ["H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  wild: "WILD",
  weights: { WILD: 3, H1: 7, H2: 9, H3: 11, L1: 20, L2: 22, L3: 24, L4: 26 },
  paytable: {
    H1: [0.47, 1.98, 9.9], H2: [0.28, 1.16, 5.25], H3: [0.175, 0.64, 2.55],
    L1: [0.07, 0.23, 0.76], L2: [0.058, 0.2, 0.64], L3: [0.035, 0.13, 0.46], L4: [0.029, 0.1, 0.33],
  },
  scatter: { symbol: "SCAT", pays: {} }, // 此遊戲不使用散佈
  features: [],
  cascade: { multipliers: [1, 2, 3, 5] },
};

/** 範例 · 連消 + 免費遊戲（兩條擴充軸疊加：base cascade + freeSpinsCascade）。 */
export const CASCADE_FG_GAME: GameDefinition = {
  id: "demo-cascade-fg",
  name: "範例 · 連消 + 免費遊戲",
  tagline: "連消遇上免費遊戲：免費局內倍率越滾越大、整輪不重置。",
  expectation: "湊 3 散佈進免費遊戲；免費局每次連消都讓全局倍率 +1，越連越狂。",
  audience: "喜歡連鎖 + 大倍率累積爆發的玩家。",
  volatilityTarget: "高（High）",
  rtpTarget: 95.0, rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways · Cascade + FG" },
  payMechanic: "ways",
  mechanics: ["cascade"],
  symbols: ["WILD", "SCAT", "H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  paying: ["H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  wild: "WILD",
  weights: { WILD: 3, SCAT: 3, H1: 7, H2: 9, H3: 11, L1: 20, L2: 22, L3: 24, L4: 26 },
  paytable: {
    H1: [0.48, 2.0, 10.2], H2: [0.29, 1.23, 5.36], H3: [0.19, 0.67, 2.68],
    L1: [0.074, 0.24, 0.8], L2: [0.062, 0.21, 0.67], L3: [0.038, 0.134, 0.48], L4: [0.031, 0.105, 0.35],
  },
  scatter: { symbol: "SCAT", pays: { 3: 2, 4: 6, 5: 20 } },
  features: [{
    id: "freeCascade", type: "freeSpinsCascade", label: "連消免費遊戲",
    category: "mode", taxonomyKey: "freeSpins",
    trigger: "盤面 3+ 散佈",
    desc: "贈免費局；免費局每局連消，全局倍率每次連消 +1（整輪不重置），3+ 散佈可再觸發。",
    params: { award: { 3: 8, 4: 12, 5: 20 }, startMult: 1, multStep: 1, retrigger: true },
  }],
  cascade: { multipliers: [1, 2, 3, 5] },
};

/** 範例 · 黏性百搭（sticky wild 重抽）。 */
export const STICKY_GAME: GameDefinition = {
  id: "demo-sticky",
  name: "範例 · 黏性百搭",
  tagline: "湊散佈進重抽，落下的百搭鎖定不走、越積越多。",
  expectation: "3+ 散佈觸發重抽；每次重抽落的 WILD 鎖定保留，落新 WILD 就回滿重抽。",
  audience: "喜歡 wild 累積、盤面越來越猛的玩家。",
  volatilityTarget: "中高（High-Med）",
  rtpTarget: 95.0, rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways · Sticky Wild" },
  payMechanic: "ways",
  symbols: ["WILD", "SCAT", "H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  paying: ["H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  wild: "WILD",
  weights: { WILD: 3, SCAT: 3.5, H1: 7, H2: 9, H3: 11, L1: 20, L2: 22, L3: 24, L4: 26 },
  paytable: {
    H1: [1.02, 4.42, 22.1], H2: [0.61, 2.72, 11.9], H3: [0.38, 1.53, 5.95],
    L1: [0.153, 0.527, 1.7], L2: [0.119, 0.442, 1.5], L3: [0.076, 0.305, 1.06], L4: [0.061, 0.221, 0.745],
  },
  scatter: { symbol: "SCAT", pays: { 3: 2, 4: 8, 5: 30 } },
  features: [{
    id: "sticky", type: "stickyWild", label: "黏性百搭重抽",
    category: "mechanic", taxonomyKey: "stickyWild",
    trigger: "盤面 3+ 散佈",
    desc: "3+ 散佈觸發重抽；落下的 WILD 鎖定保留到結束（固定重抽次數，不歸位）。",
    params: { respins: 7 },
  }],
};

/** 範例 · 漸進式頭獎（jackpot tier 抽選）。 */
export const JACKPOT_GAME: GameDefinition = {
  id: "demo-jackpot",
  name: "範例 · 漸進式頭獎",
  tagline: "湊滿 JP 符號觸發頭獎，mini → grand 四級。",
  expectation: "盤面 3+ JP 符號觸發頭獎，依權重抽 mini / minor / major / grand。",
  audience: "為頭獎而玩、追大獎的玩家。",
  volatilityTarget: "高（High，頭獎稀有）",
  rtpTarget: 95.0, rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways · Jackpot" },
  payMechanic: "ways",
  symbols: ["WILD", "JP", "H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  paying: ["H1", "H2", "H3", "L1", "L2", "L3", "L4"],
  wild: "WILD",
  weights: { WILD: 3, JP: 3.12, H1: 7, H2: 9, H3: 11, L1: 20, L2: 22, L3: 24, L4: 26 },
  paytable: {
    H1: [0.95, 4.1, 20.5], H2: [0.57, 2.52, 11.0], H3: [0.35, 1.42, 5.5],
    L1: [0.135, 0.465, 1.5], L2: [0.105, 0.39, 1.32], L3: [0.068, 0.27, 0.93], L4: [0.054, 0.195, 0.66],
  },
  scatter: { symbol: "SCAT", pays: {} },
  features: [{
    id: "jp", type: "jackpot", label: "漸進式頭獎",
    category: "mode", taxonomyKey: "jackpot",
    trigger: "盤面 3+ JP 符號", triggerSymbol: "JP", triggerMin: 3,
    desc: "3+ JP 觸發頭獎輪盤，依權重抽 mini(20) / minor(50) / major(200) / grand(1000)×押注。註：固定面額代表平均派彩；真實成長式 pot 需跨局狀態。",
    params: { tiers: [{ value: 20, weight: 60 }, { value: 50, weight: 30 }, { value: 200, weight: 9 }, { value: 1000, weight: 1 }] },
  }],
};

/** 工具內建的遊戲清單（studio 用來切換）。換遊戲 = 換一份定義。 */
export const GAMES: GameDefinition[] = [DEFAULT_GAME, HOLD_SPIN_GAME, CASCADE_GAME, CASCADE_FG_GAME, STICKY_GAME, JACKPOT_GAME];

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
