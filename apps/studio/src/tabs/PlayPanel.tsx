import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Zap, RotateCcw, Sparkles, FastForward } from "lucide-react";
import {
  buildSampler, drawBoard, evalDetailed, countScatter, refillCells, cascadeBase, BET,
  type GameDefinition, type Board, type Sampler, type FeatureDef,
} from "@slot/engine";
import { C, MONO, winTier } from "../theme";
import { Tile, Stat, Overlay, GameStage, type ReelMode } from "../ui";

/** 各遊戲的預設轉輪呈現：cascade 系→掉落；hold&spin→單格滾輪；其餘→整欄滾輪。 */
function defaultReelMode(g: GameDefinition): ReelMode {
  if (g.cascade || g.features.some((f) => f.type === "freeSpinsCascade")) return "drop";
  if (g.features.some((f) => f.type === "holdAndSpin")) return "cell";
  return "strip";
}

interface FgState { remaining: number; total: number; spinsTotal: number; done?: boolean }
interface Coin { c: number; r: number; value: number }
interface HsState { coins: Coin[]; respins: number; respinsMax: number; total: number; done?: boolean; full?: boolean }
interface CasState { step: number; mult: number; total: number }
interface FcState { remaining: number; mult: number; total: number; spinsTotal: number; done?: boolean }
interface SwState { respins: number; respinsMax: number; wilds: number; total: number; done?: boolean }
interface JpState { name: string; value: number; done?: boolean }

/** 演出時間表（normal，ms）。turbo 由 speedRef 統一縮放。 */
const TIMING = {
  SPINUP: 120, REEL_STOP_GAP: 110, REEL_SETTLE: 160, ANTICIPATION: 800,
  WIN_REVEAL: 450, WIN_MISS: 160, WIN_HOLD: 650, TIER_HOLD: 900,
  REFILL: 240, SPIN_GAP: 380, RESPIN_GAP: 460, BONUS_PAUSE: 650, JACKPOT_REVEAL: 900,
};
const TURBO_FACTOR = 0.32;

interface RunCtx { alive: () => boolean; sleep: (ms: number) => Promise<void>; sleepHold: (ms: number) => Promise<void> }

export function PlayPanel({ game }: { game: GameDefinition }) {
  // 試玩 = 設計用，亂數用 Math.random（非決定性）。演出純視覺，數值由引擎結算。
  const samplerRef = useRef<Sampler>(buildSampler(game, Math.random));
  useMemo(() => { samplerRef.current = buildSampler(game, Math.random); }, [game]);
  const fgFeat = useMemo(() => game.features.find((f) => f.type === "freeSpins"), [game.features]);
  const fgcFeat = useMemo(() => game.features.find((f) => f.type === "freeSpinsCascade"), [game.features]);
  const hsFeat = useMemo(() => game.features.find((f) => f.type === "holdAndSpin"), [game.features]);
  const swFeat = useMemo(() => game.features.find((f) => f.type === "stickyWild"), [game.features]);
  const jpFeat = useMemo(() => game.features.find((f) => f.type === "jackpot"), [game.features]);
  const coinValues: Record<string, number> = hsFeat?.params.coins ?? {};
  const coinSyms = useMemo(() => Object.keys(coinValues), [coinValues]);

  const reels = game.layout.reels, rows = game.layout.rows, totalCells = reels * rows;

  const [board, setBoard] = useState<Board>(() => drawBoard(samplerRef.current, game));
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [lastWin, setLastWin] = useState(0);
  const [tier, setTier] = useState<{ t: string; c: string } | null>(null);
  const [balance, setBalance] = useState(1000);
  const [spinning, setSpinning] = useState(false);
  const [fg, setFg] = useState<FgState | null>(null);
  const [hs, setHs] = useState<HsState | null>(null);
  const [cas, setCas] = useState<CasState | null>(null);
  const [fc, setFc] = useState<FcState | null>(null);
  const [sw, setSw] = useState<SwState | null>(null);
  const [jp, setJp] = useState<JpState | null>(null);
  // 滾輪轉動狀態
  const [landedCols, setLandedCols] = useState(reels);
  const [spinningCols, setSpinningCols] = useState<Set<number>>(new Set());
  const [anticip, setAnticip] = useState<Set<number>>(new Set());
  const [reelMode, setReelMode] = useState<ReelMode>(() => defaultReelMode(game));
  const reelStripsRef = useRef<string[][][]>([]); // [reel][row] → 該格捲動帶
  // turbo / 流程版本（取代 clearTimers）
  const [turbo, setTurbo] = useState(false);
  const speedRef = useRef(1);
  useEffect(() => { speedRef.current = turbo ? TURBO_FACTOR : 1; }, [turbo]);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; runIdRef.current++; }, []);

  // 開一個新流程：回傳可中止的 alive + sleep（吃 speed factor；hold 類設地板 0.4 避免完全看不見）。
  const makeRun = useCallback((): RunCtx => {
    const myId = ++runIdRef.current;
    const alive = () => myId === runIdRef.current && mountedRef.current;
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, Math.max(1, Math.round(ms * speedRef.current))));
    const sleepHold = (ms: number) => new Promise<void>((res) => setTimeout(res, Math.max(1, Math.round(ms * Math.max(speedRef.current, 0.4)))));
    return { alive, sleep, sleepHold };
  }, []);

  const resetVisual = useCallback(() => {
    setFg(null); setHs(null); setCas(null); setFc(null); setSw(null); setJp(null);
    setTier(null); setWinCells(new Set()); setSpinningCols(new Set()); setAnticip(new Set()); setLandedCols(reels);
  }, [reels]);

  // 換遊戲：中止進行中的動畫、清狀態、重抽新盤面。
  useEffect(() => {
    runIdRef.current++;
    resetVisual(); setLastWin(0); setSpinning(false); setReelMode(defaultReelMode(game));
    setBoard(drawBoard(samplerRef.current, game));
  }, [game]); // eslint-disable-line react-hooks/exhaustive-deps

  // 重抽落幣面額（依金幣符號權重比，與引擎一致）。
  const drawCoinValue = useCallback(() => {
    let tot = 0; for (const s of coinSyms) tot += game.weights[s] || 0;
    let r = Math.random() * tot;
    for (const s of coinSyms) { r -= (game.weights[s] || 0); if (r < 0) return coinValues[s]; }
    return coinValues[coinSyms[coinSyms.length - 1]] ?? 0;
  }, [coinSyms, coinValues, game.weights]);

  const sumCoins = (cs: Coin[]) => cs.reduce((s, k) => s + k.value, 0);

  const trigCount = useCallback((b: Board, f: FeatureDef) => {
    const trig = f.triggerSymbol ?? game.scatter.symbol;
    const syms = Array.isArray(trig) ? trig : [trig];
    let n = 0; for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) if (syms.includes(b[c][r])) n++;
    return n;
  }, [game, reels, rows]);

  // 預報：對每個會數符號進 bonus 的機制，找「差一個就中」的最早欄 → 該欄起全部標記。
  const computeAnticipation = useCallback((b: Board) => {
    const set = new Set<number>();
    for (const f of game.features) {
      const trig = f.triggerSymbol ?? game.scatter.symbol;
      const syms = Array.isArray(trig) ? trig : [trig];
      const min = f.triggerMin ?? 3;
      let running = 0;
      for (let c = 0; c < reels; c++) {
        if (running === min - 1) { for (let k = c; k < reels; k++) set.add(k); break; }
        for (let r = 0; r < rows; r++) if (syms.includes(b[c][r])) running++;
      }
    }
    return set;
  }, [game, reels, rows]);

  // 滾輪轉動 + 逐欄緩停（含預報）→ 落定。主 SPIN 與「免費局每一局」共用，
  // 所以免費遊戲也是真的轉輪，不是瞬間開獎。
  const revealReels = useCallback(async (b: Board, ctx: RunCtx, withAnticip = true): Promise<boolean> => {
    const { alive, sleep } = ctx;
    const strips: string[][][] = [];
    for (let c = 0; c < reels; c++) {
      const col: string[][] = [];
      for (let r = 0; r < rows; r++) { const cell: string[] = []; for (let i = 0; i < rows + 5; i++) cell.push(samplerRef.current()); col.push(cell); }
      strips.push(col);
    }
    reelStripsRef.current = strips;
    const ant = withAnticip ? computeAnticipation(b) : new Set<number>();
    setBoard(b.map((c) => c.slice())); setAnticip(ant); setLandedCols(0);
    setSpinningCols(new Set(Array.from({ length: reels }, (_, i) => i)));
    await sleep(TIMING.SPINUP); if (!alive()) return false;
    for (let c = 0; c < reels; c++) {
      const extra = ant.has(c) ? TIMING.ANTICIPATION : 0;
      await sleep(TIMING.REEL_STOP_GAP + c * 15 + extra); if (!alive()) return false;
      setLandedCols(c + 1);
      setSpinningCols((prev) => { const n = new Set(prev); n.delete(c); return n; });
    }
    setSpinningCols(new Set()); setLandedCols(reels);
    return true;
  }, [reels, rows, computeAnticipation]);

  // ---- 免費遊戲（每局真的轉輪 → 命中停久、空轉快速帶過）----
  const runFG = useCallback(async (startSpins: number, ctx: RunCtx) => {
    if (!fgFeat) { setSpinning(false); return; }
    const { alive, sleepHold } = ctx;
    const p = fgFeat.params;
    let remaining = startSpins, total = 0, guard = 0;
    setFg({ remaining, total: 0, spinsTotal: startSpins });
    while (remaining > 0 && guard < 400 && alive()) {
      guard++; remaining--;
      const b = drawBoard(samplerRef.current, game);
      if (!(await revealReels(b, ctx, true))) return;
      const det = evalDetailed(b, game); const sc = countScatter(b, game);
      let w = det.win * p.multiplier;
      if (sc >= 3) { w += (game.scatter.pays[Math.min(sc, 5)] || 0) * p.multiplier; if (p.retrigger) remaining += p.award[Math.min(sc, 5)]; }
      total += w; setWinCells(det.cells); setFg({ remaining, total, spinsTotal: startSpins });
      await sleepHold(w > 0 ? TIMING.WIN_HOLD : TIMING.WIN_MISS); if (!alive()) return;
      setWinCells(new Set());
    }
    if (!alive()) return;
    setBalance((x) => x + total); setLastWin(total);
    setFg((f) => (f ? { ...f, done: true, total } : f));
    await sleepHold(TIMING.TIER_HOLD); if (!alive()) return;
    setSpinning(false);
  }, [fgFeat, game, revealReels]);

  // ---- Hold & Spin（接近填滿時放慢、填滿前懸念）----
  const runHoldSpin = useCallback(async (initial: Coin[], { alive, sleep, sleepHold }: RunCtx) => {
    if (!hsFeat) { setSpinning(false); return; }
    const respinsMax: number = hsFeat.params.respins;
    const p: number = hsFeat.params.respinCoinChance;
    const bonus: number = hsFeat.params.fullScreenBonus ?? 0;
    let coins = [...initial]; let respins = respinsMax, guard = 0;
    setWinCells(new Set()); setHs({ coins, respins, respinsMax, total: sumCoins(coins) });
    while (respins > 0 && coins.length < totalCells && guard < 100 && alive()) {
      guard++;
      await sleep(coins.length >= totalCells - 2 ? TIMING.BONUS_PAUSE : TIMING.RESPIN_GAP); if (!alive()) return;
      const occupied = new Set(coins.map((k) => k.c + "-" + k.r));
      let landed = 0; const next = [...coins];
      for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) {
        if (occupied.has(c + "-" + r)) continue;
        if (Math.random() < p) { next.push({ c, r, value: drawCoinValue() }); landed++; }
      }
      coins = next; respins = landed > 0 ? respinsMax : respins - 1;
      setHs({ coins, respins, respinsMax, total: sumCoins(coins) });
    }
    if (!alive()) return;
    const full = coins.length >= totalCells; const total = sumCoins(coins) + (full ? bonus : 0);
    if (full) { await sleepHold(TIMING.BONUS_PAUSE); if (!alive()) return; }
    setHs({ coins, respins: 0, respinsMax, total, done: true, full });
    setBalance((x) => x + total); setLastWin(total);
    await sleepHold(TIMING.TIER_HOLD); if (!alive()) return;
    setSpinning(false);
  }, [hsFeat, drawCoinValue, reels, rows, totalCells]);

  // ---- Cascade 連消（亮格看清 → 消除補新 → 再算，倍率遞增）----
  const runCascade = useCallback(async (startBoard: Board, { alive, sleep, sleepHold }: RunCtx) => {
    const mults = game.cascade!.multipliers; const b2 = startBoard.map((c) => c.slice());
    let step = 0, total = 0;
    while (alive()) {
      const det = evalDetailed(b2, game);
      if (det.win <= 0) break;
      const m = mults[Math.min(step, mults.length - 1)]; total += det.win * m; step++;
      setBoard(b2.map((c) => c.slice())); setWinCells(det.cells); setCas({ step, mult: m, total });
      await sleep(TIMING.WIN_HOLD); if (!alive()) return;
      refillCells(b2, det.cells, samplerRef.current);
      setBoard(b2.map((c) => c.slice())); setWinCells(new Set());
      await sleep(TIMING.REFILL); if (!alive()) return;
    }
    if (!alive()) return;
    setWinCells(new Set()); setCas(null);
    setBalance((x) => x + total); setLastWin(total); setTier(winTier(total / BET));
    if (total / BET >= 5) await sleepHold(TIMING.TIER_HOLD);
    if (!alive()) return;
    setSpinning(false);
  }, [game]);

  // ---- 連消免費遊戲（全程倍率累積，不重置）----
  const runFreeCascade = useCallback(async (startSpins: number, feature: FeatureDef, ctx: RunCtx) => {
    const { alive, sleep, sleepHold } = ctx;
    const inc: number = feature.params.multStep ?? 1; let gm: number = feature.params.startMult ?? 1;
    let remaining = startSpins, total = 0, guard = 0;
    setFc({ remaining, mult: gm, total: 0, spinsTotal: startSpins });
    while (remaining > 0 && guard < 600 && alive()) {
      guard++; remaining--;
      const b = drawBoard(samplerRef.current, game);
      if (!(await revealReels(b, ctx, true))) return;
      setFc({ remaining, mult: gm, total, spinsTotal: startSpins });
      while (alive()) {
        const det = evalDetailed(b, game);
        if (det.win <= 0) break;
        total += det.win * gm; gm += inc;
        setBoard(b.map((c) => c.slice())); setWinCells(det.cells); setFc({ remaining, mult: gm, total, spinsTotal: startSpins });
        await sleep(TIMING.WIN_HOLD); if (!alive()) return;
        refillCells(b, det.cells, samplerRef.current);
        setBoard(b.map((c) => c.slice())); setWinCells(new Set());
        await sleep(TIMING.REFILL); if (!alive()) return;
      }
      const sc = countScatter(b, game);
      if (sc >= 3 && feature.params.retrigger) remaining += feature.params.award[Math.min(sc, 5)];
    }
    if (!alive()) return;
    setWinCells(new Set()); setFc((f) => (f ? { ...f, remaining: 0, mult: gm, total, done: true } : f));
    setBalance((x) => x + total); setLastWin(total); setTier(winTier(total / BET));
    await sleepHold(TIMING.TIER_HOLD); if (!alive()) return;
    setSpinning(false);
  }, [game, revealReels]);

  // ---- 黏性百搭（固定重抽、wild 累積）----
  const runSticky = useCallback(async (feature: FeatureDef, { alive, sleep, sleepHold }: RunCtx) => {
    const respinsMax: number = feature.params.respins;
    const locked = new Set<string>();
    let respins = respinsMax, total = 0, guard = 0;
    setSw({ respins, respinsMax, wilds: 0, total: 0 });
    while (respins > 0 && guard < 50 && alive()) {
      guard++; respins--;
      await sleep(TIMING.RESPIN_GAP); if (!alive()) return;
      const b = drawBoard(samplerRef.current, game);
      for (const cr of locked) { const i = cr.indexOf("-"); b[+cr.slice(0, i)][+cr.slice(i + 1)] = game.wild; }
      for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) { const k = c + "-" + r; if (b[c][r] === game.wild && !locked.has(k)) locked.add(k); }
      const det = evalDetailed(b, game); total += det.win;
      setBoard(b.map((c) => c.slice())); setWinCells(det.cells); setSw({ respins, respinsMax, wilds: locked.size, total });
    }
    if (!alive()) return;
    setBalance((x) => x + total); setLastWin(total); setTier(winTier(total / BET));
    setSw((s) => (s ? { ...s, respins: 0, total, done: true } : s));
    await sleepHold(TIMING.TIER_HOLD); if (!alive()) return;
    setSpinning(false);
  }, [game, reels, rows]);

  // ---- 頭獎揭示 ----
  const runJackpot = useCallback(async (feature: FeatureDef, { alive, sleepHold }: RunCtx) => {
    const tiers: { value: number; weight: number }[] = feature.params.tiers;
    let tot = 0; for (const t of tiers) tot += t.weight;
    let r = Math.random() * tot, idx = tiers.length - 1;
    for (let i = 0; i < tiers.length; i++) { r -= tiers[i].weight; if (r < 0) { idx = i; break; } }
    const names = ["MINI", "MINOR", "MAJOR", "GRAND"]; const value = tiers[idx].value;
    setJp({ name: names[idx] ?? `T${idx}`, value });
    await sleepHold(TIMING.JACKPOT_REVEAL); if (!alive()) return;
    setJp({ name: names[idx] ?? `T${idx}`, value, done: true });
    setBalance((x) => x + value); setLastWin(value);
    await sleepHold(idx >= 3 ? TIMING.TIER_HOLD * 2 : TIMING.TIER_HOLD); if (!alive()) return;
    setSpinning(false);
  }, []);

  const finish = useCallback(async (b: Board, ctx: RunCtx) => {
    const sc = countScatter(b, game);
    // 連消免費遊戲（cascade + FG）：免費局是主秀；base 連消贏分靜默加入。
    if (fgcFeat && sc >= (fgcFeat.triggerMin ?? 3)) {
      if (game.cascade) setBalance((x) => x + cascadeBase(b, game, samplerRef.current).win);
      setTier(null); await runFreeCascade(fgcFeat.params.award[Math.min(sc, 5)], fgcFeat, ctx); return;
    }
    if (game.cascade) { await runCascade(b, ctx); return; }
    // 非連消 base 結算
    const det = evalDetailed(b, game); let scPay = 0;
    if (sc >= 3) {
      scPay = game.scatter.pays[Math.min(sc, 5)] || 0;
      for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) if (b[c][r] === game.scatter.symbol) det.cells.add(c + "-" + r);
    }
    const w = det.win + scPay; setWinCells(det.cells); setLastWin(w); setBalance((x) => x + w);
    if (hsFeat) {
      const initial: Coin[] = [];
      for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) { const v = coinValues[b[c][r]]; if (v !== undefined) initial.push({ c, r, value: v }); }
      if (initial.length >= (hsFeat.triggerMin ?? 6)) { setTier(null); await runHoldSpin(initial, ctx); return; }
    }
    if (swFeat && sc >= (swFeat.triggerMin ?? 3)) { setTier(null); await runSticky(swFeat, ctx); return; }
    if (jpFeat && trigCount(b, jpFeat) >= (jpFeat.triggerMin ?? 3)) { setTier(null); await runJackpot(jpFeat, ctx); return; }
    const t = winTier(w / BET); setTier(t);
    if (sc >= 3 && fgFeat) { await runFG(fgFeat.params.award[Math.min(sc, 5)], ctx); return; }
    // 一般 base 局：停一下讓玩家看清中獎，再結束。
    if (t) await ctx.sleepHold(TIMING.TIER_HOLD);
    else if (w > 0) await ctx.sleepHold(TIMING.WIN_HOLD);
    if (!ctx.alive()) return;
    setSpinning(false);
  }, [game, fgFeat, fgcFeat, hsFeat, swFeat, jpFeat, coinValues, runFG, runHoldSpin, runCascade, runFreeCascade, runSticky, runJackpot, trigCount, reels, rows]);

  // 一次 SPIN 生命週期：起轉 → 逐欄緩停(含預報) → 看清停頓 → 結算/機制。
  const playBoard = useCallback(async (b: Board) => {
    const ctx = makeRun();
    resetVisual(); setLastWin(0); setSpinning(true); setBalance((x) => x - BET);
    if (!(await revealReels(b, ctx, true))) return;
    const det = evalDetailed(b, game); const sc = countScatter(b, game);
    await ctx.sleepHold(det.win > 0 || sc >= 3 ? TIMING.WIN_REVEAL : TIMING.WIN_MISS); if (!ctx.alive()) return;
    await finish(b, ctx);
  }, [makeRun, resetVisual, revealReels, game, finish]);

  const spin = useCallback(() => { if (spinning) return; void playBoard(drawBoard(samplerRef.current, game)); }, [spinning, playBoard, game]);

  // 強制做出觸發盤面，直接看演出。
  const buildTriggerBoard = useCallback((feature: FeatureDef): Board => {
    const b = drawBoard(samplerRef.current, game);
    const trig = feature.triggerSymbol ?? game.scatter.symbol;
    const syms = Array.isArray(trig) ? trig : [trig];
    const min = feature.triggerMin ?? 3;
    const cells: [number, number][] = [];
    for (let c = 0; c < reels; c++) for (let r = 0; r < rows; r++) cells.push([c, r]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    for (let k = 0; k < Math.min(min, cells.length); k++) { const [c, r] = cells[k]; b[c][r] = syms[Math.floor(Math.random() * syms.length)]; }
    return b;
  }, [game, reels, rows]);

  const forceEnter = useCallback((feature: FeatureDef) => { if (spinning) return; void playBoard(buildTriggerBoard(feature)); }, [spinning, playBoard, buildTriggerBoard]);

  const reset = () => {
    runIdRef.current++; resetVisual(); setLastWin(0); setSpinning(false); setBalance(1000);
    setBoard(drawBoard(samplerRef.current, game));
  };

  // 表現層事件對照（依機制換內容）
  const events: [string, string, string][] = hsFeat
    ? [["贏分 ≥ 5×", "BIG WIN", C.gold], ["贏分 ≥ 15×", "MEGA WIN", C.red], [`${hsFeat.triggerMin ?? 6}+ 金幣`, "進入 Hold & Spin", C.value], ["填滿 15 格", "頂獎 + 加給", C.purple]]
    : [["贏分 ≥ 5×", "BIG WIN", C.gold], ["贏分 ≥ 15×", "MEGA WIN", C.red], ["贏分 ≥ 50×", "EPIC WIN", C.purple], ["差一個觸發", "預報（輪帶轉更久）", C.teal]];

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 16, marginTop: 18 }}>
      <GameStage
        reels={reels}
        rows={rows}
        landedCols={landedCols}
        spinningCols={spinningCols}
        anticipationCols={anticip}
        reelStrip={(c, r = 0) => reelStripsRef.current[c]?.[r] ?? []}
        settleMs={Math.round(TIMING.REEL_SETTLE * Math.max(speedRef.current, 0.4))}
        reelMode={reelMode}
        renderCell={(c, r) => {
          if (hs) {
            const coin = hs.coins.find((k) => k.c === c && k.r === r);
            return coin ? <CoinTile value={coin.value} /> : <BlankTile />;
          }
          const s = board[c][r];
          return <Tile sym={s} win={winCells.has(c + "-" + r)} dim={winCells.size > 0 && !winCells.has(c + "-" + r)} />;
        }}
        overlay={<>
          {tier && !fg && !hs && !cas && !fc && !sw && !jp && <Overlay border={tier.c} title={tier.t} big sub={`+${lastWin.toFixed(2)}x`} />}
          {cas && <Overlay border={C.teal} title={`連消 ×${cas.mult}`} sub={`第 ${cas.step} 連`} value={`+${cas.total.toFixed(2)}x`} />}
          {fc && <Overlay border={C.purple} title={fc.done ? "免費遊戲結束" : "連消免費遊戲"} sub={fc.done ? `共 ${fc.spinsTotal} 局` : `剩餘 ${fc.remaining} 局 · 倍率 ×${fc.mult}`} value={`+${fc.total.toFixed(2)}x`} />}
          {sw && <Overlay border={C.gold} title={sw.done ? "黏性百搭結束" : "黏性百搭重抽"} sub={sw.done ? `鎖定 ${sw.wilds} 個 WILD` : `剩餘 ${sw.respins}/${sw.respinsMax} · 鎖定 ${sw.wilds}`} value={`+${sw.total.toFixed(2)}x`} />}
          {jp && <Overlay border={C.red} title={jp.done ? `頭獎 ${jp.name}！` : "頭獎抽選中…"} value={jp.done ? `+${jp.value.toFixed(0)}x` : ""} />}
          {fg && <Overlay border={C.purple} title={fg.done ? "免費遊戲結束" : "免費遊戲"} sub={fg.done ? `共 ${fg.spinsTotal} 局` : `剩餘 ${fg.remaining} 局 · ×${fgFeat?.params.multiplier}`} value={`+${fg.total.toFixed(2)}x`} />}
          {hs && <Overlay border={hs.full ? C.value : C.gold} title={hs.done ? (hs.full ? "填滿盤面！頂獎" : "Hold & Spin 結束") : "HOLD & SPIN"} sub={hs.done ? `${hs.coins.length} 枚金幣` : `重抽 ${hs.respins}/${hs.respinsMax} · ${hs.coins.length}/${totalCells} 枚`} value={`+${hs.total.toFixed(2)}x`} />}
        </>}
      />
      <div className="flex" style={{ flexDirection: "column", gap: 12 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="餘額" value={balance.toFixed(0)} />
          <Stat label="上局贏分" value={(lastWin > 0 ? "+" : "") + lastWin.toFixed(2) + "x"} accent={lastWin > 0 ? C.value : C.faint} />
        </div>
        <button onClick={spin} disabled={spinning} className="flex items-center justify-center rounded-xl" style={{ gap: 8, padding: 16, fontSize: 18, fontWeight: 800, cursor: spinning ? "default" : "pointer", border: "none", background: spinning ? C.goldDim : C.gold, color: C.ink, opacity: spinning ? 0.7 : 1 }}>
          <Zap size={20} /> {spinning ? "轉動中…" : "SPIN（押注 1）"}
        </button>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={() => setTurbo((t) => !t)} className="flex items-center justify-center rounded-lg" style={{ gap: 6, padding: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", background: turbo ? C.teal : C.panel2, color: turbo ? C.ink : C.dim, border: `1px solid ${turbo ? C.teal : C.line}` }}>
            <FastForward size={14} /> {turbo ? "加速中" : "加速模式"}
          </button>
          <button onClick={reset} className="flex items-center justify-center rounded-lg" style={{ gap: 6, padding: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", color: C.dim, border: `1px solid ${C.line}` }}>
            <RotateCcw size={14} /> 重設餘額
          </button>
        </div>
        <div className="flex items-center rounded-lg p-2" style={{ background: C.panel, border: `1px solid ${C.line}`, gap: 4 }}>
          <span style={{ fontSize: 11, color: C.faint, marginRight: 2 }}>轉輪</span>
          {([["strip", "整欄滾輪"], ["cell", "單格滾輪"], ["drop", "掉落"]] as [ReelMode, string][]).map(([m, lbl]) => (
            <button key={m} onClick={() => setReelMode(m)} disabled={spinning} className="rounded-md" style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: spinning ? "default" : "pointer", border: "none", background: reelMode === m ? C.teal : C.panel2, color: reelMode === m ? C.ink : C.dim, opacity: spinning ? 0.6 : 1 }}>{lbl}</button>
          ))}
        </div>
        {game.features.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div style={{ color: C.purple, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>強制進入機制（看演出）</div>
            <div className="flex" style={{ flexDirection: "column", gap: 6 }}>
              {game.features.map((f) => (
                <button key={f.id} onClick={() => forceEnter(f)} disabled={spinning} className="flex items-center justify-center rounded-md" style={{ gap: 6, padding: 9, fontSize: 13, fontWeight: 700, cursor: spinning ? "default" : "pointer", border: `1px solid ${C.purpleDim}`, background: C.panel2, color: C.purple, opacity: spinning ? 0.55 : 1 }}>
                  <Sparkles size={14} /> 直接進「{f.label}」
                </button>
              ))}
            </div>
            <div style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>做出觸發盤面、直接播該機制的演出（押注照扣），不用等隨機觸發。</div>
          </div>
        )}
        <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>數值事件 → 表現層</div>
          {events.map(([cond, resp, col], i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: 12.5, padding: "3px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <span style={{ color: C.dim, fontFamily: MONO }}>{cond}</span><span style={{ color: col, fontWeight: 700 }}>{resp}</span>
            </div>
          ))}
          <div style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>滾輪、緩停、預報、得獎停頓、慶祝分級都由「數值」驅動 — 表現服務數值。加速模式只縮放演出、不改數值。</div>
        </div>
      </div>
    </div>
  );
}

/** Hold & Spin 鎖定金幣格（顯示面額）。 */
function CoinTile({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-center rounded-md select-none" style={{
      background: "radial-gradient(circle at 35% 30%, #F7D277, #E8B339 55%, #B5851E)", color: "#3a2a06",
      width: "100%", aspectRatio: "1/1", fontWeight: 900, fontSize: "clamp(12px,3vw,20px)",
      boxShadow: `0 0 0 2px ${C.gold}, 0 0 12px ${C.gold}55`, fontFamily: MONO,
    }}>{value % 1 === 0 ? value : value.toFixed(2)}</div>
  );
}

/** Hold & Spin 空格（暗格）。 */
function BlankTile() {
  return <div className="rounded-md" style={{ background: C.panel2, border: `1px dashed ${C.line}`, width: "100%", aspectRatio: "1/1", opacity: 0.5 }} />;
}
