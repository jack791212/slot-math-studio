import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, AreaChart, Area, Cell,
} from "recharts";
import { Play, RotateCcw, Zap, Coins, FlaskConical, Sparkles, Loader2, FileText, Download, Check, X, AlertTriangle, Puzzle } from "lucide-react";

/* ============================================================
   SLOT 數值設計工作站 — v2
   架構：引擎讀「遊戲定義(game)」+「機制模組(FEATURE_HANDLERS)」
   → 換遊戲 = 換定義；加機制 = 註冊一個模組。整份 game 可序列化成 JSON。
   引擎邏輯與 Node 5,000,000 局驗證版一致：預設 RTP≈94.8%、feature 佔 41%。
   ============================================================ */

const C = {
  ink: "#0E1116", panel: "#161B22", panel2: "#1C232D", line: "#2A323D",
  text: "#E6EDF3", dim: "#8B97A7", faint: "#5A6675",
  gold: "#E8B339", goldDim: "#8a6a1f", value: "#F2C75C",
  teal: "#3FB6A8", tealDim: "#1f5a55", red: "#E5534B", purple: "#A371F7",
  green: "#3FB950", sky: "#4A9EE8", purpleDim: "#5b3fa0",
};
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const META = {
  WILD: { label: "W", bg: "#E8B339", fg: "#0E1116", name: "WILD（百搭）" },
  SCAT: { label: "★", bg: "#A371F7", fg: "#FFFFFF", name: "SCATTER（散佈）" },
  H1: { label: "H1", bg: "#C9433B", fg: "#FFFFFF", name: "高分 1" },
  H2: { label: "H2", bg: "#2E9E57", fg: "#FFFFFF", name: "高分 2" },
  H3: { label: "H3", bg: "#3A82C4", fg: "#FFFFFF", name: "高分 3" },
  L1: { label: "A", bg: "#39424E", fg: "#C7D0DB", name: "低分 A" },
  L2: { label: "K", bg: "#363F4A", fg: "#C7D0DB", name: "低分 K" },
  L3: { label: "Q", bg: "#333B46", fg: "#C7D0DB", name: "低分 Q" },
  L4: { label: "J", bg: "#2F3741", fg: "#C7D0DB", name: "低分 J" },
};
const ALL_SYMS = ["WILD", "SCAT", "H1", "H2", "H3", "L1", "L2", "L3", "L4"];
const PAYING = ["H1", "H2", "H3", "L1", "L2", "L3", "L4"];

/* ---------------- 遊戲定義（單一真實來源，可序列化） ---------------- */
const DEFAULT_GAME = {
  id: "demo-243",
  name: "範例 · 烈焰 243",
  tagline: "中高波動，免費遊戲扛起四成 RTP — 主打「進 bonus」的期待感。",
  expectation: "湊滿 3 個散佈進免費遊戲，×8 倍率把小獎放大成大獎。",
  audience: "願意忍受空轉、為大獎而玩、會追 bonus 的玩家。",
  volatilityTarget: "中高（High-Med）",
  rtpTarget: 95.0,
  rtpTolerance: 0.5,
  layout: { reels: 5, rows: 3, model: "243 ways" },
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
    // ↑ 要新增機制：在 FEATURE_HANDLERS 註冊一個 type，再到這個陣列加一筆即可。
    // 例：sticky wild、hold & spin / 重抽、cascade 連消、漸進式 JP …
  ],
};
const BET = 1;

/* ---------------- 引擎（純函式，讀 game） ---------------- */
function buildSampler(weights) {
  const total = ALL_SYMS.reduce((s, k) => s + (weights[k] || 0), 0);
  const cum = []; let acc = 0;
  for (const k of ALL_SYMS) { acc += (weights[k] || 0); cum.push([k, acc / total]); }
  return () => { const r = Math.random(); for (const [k, c] of cum) if (r < c) return k; return cum[cum.length - 1][0]; };
}
function drawBoard(s) { const b = []; for (let c = 0; c < 5; c++) { const col = []; for (let r = 0; r < 3; r++) col.push(s()); b.push(col); } return b; }
function countScatter(b, g) { let n = 0; for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) if (b[c][r] === g.scatter.symbol) n++; return n; }
function evalWays(b, g) {
  let win = 0;
  for (const sym of PAYING) {
    const cnt = [];
    for (let c = 0; c < 5; c++) { let k = 0; for (let r = 0; r < 3; r++) { const s = b[c][r]; if (s === sym || s === "WILD") k++; } if (k === 0) break; cnt.push(k); }
    if (cnt.length >= 3) { let w = 1; for (let i = 0; i < cnt.length; i++) w *= cnt[i]; win += g.paytable[sym][cnt.length - 3] * w; }
  }
  return win;
}
function evalDetailed(b, g) {
  let win = 0; const cells = new Set();
  for (const sym of PAYING) {
    const cnt = [];
    for (let c = 0; c < 5; c++) { let k = 0; for (let r = 0; r < 3; r++) { const s = b[c][r]; if (s === sym || s === "WILD") k++; } if (k === 0) break; cnt.push(k); }
    if (cnt.length >= 3) {
      let w = 1; for (let i = 0; i < cnt.length; i++) w *= cnt[i]; win += g.paytable[sym][cnt.length - 3] * w;
      for (let c = 0; c < cnt.length; c++) for (let r = 0; r < 3; r++) { const s = b[c][r]; if (s === sym || s === "WILD") cells.add(c + "-" + r); }
    }
  }
  return { win, cells };
}
// 機制模組登錄表 — 新機制在此註冊
const FEATURE_HANDLERS = {
  freeSpins: (sampler, params, g) => (count) => {
    let total = 0, remaining = params.award[Math.min(count, 5)], guard = 0;
    while (remaining > 0 && guard < 20000) {
      guard++; remaining--;
      const b = drawBoard(sampler);
      total += evalWays(b, g) * params.multiplier;
      const sc = countScatter(b, g);
      if (sc >= 3) { total += (g.scatter.pays[Math.min(sc, 5)] || 0) * params.multiplier; if (params.retrigger) remaining += params.award[Math.min(sc, 5)]; }
    }
    return total;
  },
};
function spinOnce(sampler, g) {
  const b = drawBoard(sampler);
  let base = evalWays(b, g), feature = 0; const perFeature = {};
  const sc = countScatter(b, g);
  if (sc >= 3) {
    base += (g.scatter.pays[Math.min(sc, 5)] || 0);
    for (const f of g.features) {
      const handler = FEATURE_HANDLERS[f.type]; if (!handler) continue;
      const w = handler(sampler, f.params, g)(sc);
      perFeature[f.id] = (perFeature[f.id] || 0) + w; feature += w;
    }
  }
  return { base, feature, total: base + feature, perFeature, triggered: sc >= 3 };
}

const BUCKET_LABELS = ["0x", "0–1x", "1–2x", "2–5x", "5–10x", "10–50x", "50–100x", "100x+"];
function bucketIndex(x) { if (x <= 0) return 0; if (x < 1) return 1; if (x < 2) return 2; if (x < 5) return 3; if (x < 10) return 4; if (x < 50) return 5; if (x < 100) return 6; return 7; }
function winTier(m) { if (m >= 50) return { t: "EPIC WIN", c: C.purple }; if (m >= 15) return { t: "MEGA WIN", c: C.red }; if (m >= 5) return { t: "BIG WIN", c: C.gold }; return null; }

function finalizeRes(game, spins, a, buckets, conv, ms) {
  const mean = a.sumPay / spins; const variance = a.sumSq / spins - mean * mean; const sd = Math.sqrt(Math.max(variance, 0));
  const se = sd / Math.sqrt(spins);
  const perFeature = {}; for (const k in a.perFeature) perFeature[k] = a.perFeature[k] / (spins * BET);
  const perFeatureTrig = {}; for (const k in a.perFeatureTrig) perFeatureTrig[k] = a.perFeatureTrig[k];
  return {
    spins, ms, rtp: a.sumPay / (spins * BET), rtpBase: a.sumBase / (spins * BET), rtpFeat: a.sumFeat / (spins * BET),
    hitRate: a.hits / spins, triggerOneIn: a.trig ? spins / a.trig : Infinity, sd, maxWin: a.maxWin, se,
    perFeature, perFeatureTrig,
    buckets: buckets.map((b, i) => ({ name: BUCKET_LABELS[i], pct: (b / spins) * 100, idx: i })),
    conv,
  };
}
// 同步模擬（掛載時的快速首跑用）
function runSimulationSync(game, spins) {
  const sampler = buildSampler(game.weights);
  const a = { sumPay: 0, sumBase: 0, sumFeat: 0, sumSq: 0, hits: 0, trig: 0, maxWin: 0, perFeature: {}, perFeatureTrig: {} };
  const buckets = new Array(8).fill(0); const conv = []; const step = Math.max(1, Math.floor(spins / 120));
  const t0 = performance.now();
  for (let i = 0; i < spins; i++) {
    const r = spinOnce(sampler, game);
    a.sumPay += r.total; a.sumBase += r.base; a.sumFeat += r.feature; a.sumSq += r.total * r.total;
    if (r.total > 0) a.hits++; if (r.triggered) a.trig++; if (r.total > a.maxWin) a.maxWin = r.total;
    for (const k in r.perFeature) { a.perFeature[k] = (a.perFeature[k] || 0) + r.perFeature[k]; a.perFeatureTrig[k] = (a.perFeatureTrig[k] || 0) + 1; }
    buckets[bucketIndex(r.total / BET)]++;
    if (i % step === 0) conv.push({ n: i + 1, rtp: (a.sumPay / ((i + 1) * BET)) * 100 });
  }
  return finalizeRes(game, spins, a, buckets, conv, Math.round(performance.now() - t0));
}

/* ---------------- 共用小元件 ---------------- */
function Tile({ sym, dim, win }) {
  const m = META[sym];
  return <div className="flex items-center justify-center rounded-md select-none" style={{ background: m.bg, color: m.fg, width: "100%", aspectRatio: "1/1", fontWeight: 800, fontSize: "clamp(13px,3.2vw,22px)", boxShadow: win ? `0 0 0 2px ${C.gold},0 0 14px ${C.gold}66` : "none", opacity: dim ? 0.28 : 1, transition: "opacity .25s,box-shadow .2s", fontFamily: MONO }}>{m.label}</div>;
}
function Stat({ label, value, sub, accent }) {
  return <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
    <div style={{ color: C.dim, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</div>
    <div style={{ color: accent || C.text, fontSize: 24, fontWeight: 800, marginTop: 2, fontFamily: MONO, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>{sub}</div>}
  </div>;
}
const pct = (x) => (x * 100).toFixed(2) + "%";

/* ====================== 主元件 ====================== */
export default function App() {
  const [tab, setTab] = useState("play");
  const [game, setGame] = useState(DEFAULT_GAME);
  const [simRes, setSimRes] = useState(null);

  // 掛載時快速首跑，讓實驗室與規格書一進來就有數字
  useEffect(() => { setSimRes(runSimulationSync(DEFAULT_GAME, 300000)); }, []);

  const tabs = [["play", "試玩", Play], ["lab", "數值實驗室", FlaskConical], ["spec", "規格書", FileText]];
  return (
    <div style={{ background: C.ink, color: C.text, minHeight: "100%", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 16px 48px" }}>
        <div className="flex items-end justify-between" style={{ flexWrap: "wrap", gap: 12, borderBottom: `1px solid ${C.line}`, paddingBottom: 14 }}>
          <div>
            <div style={{ color: C.gold, fontSize: 11, letterSpacing: ".18em", fontWeight: 700, textTransform: "uppercase" }}>數值設計工作站 · v2</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{game.name} <span style={{ color: C.dim, fontWeight: 600, fontSize: 18 }}>· {game.layout.model} · 權重+RNG</span></div>
          </div>
          <div className="flex" style={{ gap: 6, background: C.panel, padding: 4, borderRadius: 10, border: `1px solid ${C.line}` }}>
            {tabs.map(([id, lbl, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className="flex items-center rounded-md"
                style={{ gap: 6, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: tab === id ? C.gold : "transparent", color: tab === id ? C.ink : C.dim }}>
                <Icon size={15} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {tab === "play" && <PlayPanel game={game} />}
        {tab === "lab" && <LabPanel game={game} setGame={setGame} simRes={simRes} setSimRes={setSimRes} />}
        {tab === "spec" && <SpecPanel game={game} setGame={setGame} simRes={simRes} goLab={() => setTab("lab")} />}

        <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.line}`, color: C.faint, fontSize: 11.5, lineHeight: 1.6 }}>
          設計駕駛艙，非上線認證模擬 — 最終 RTP 定案須 RD 用產品引擎、更大樣本與第三方認證。
          架構：引擎讀「遊戲定義」＋「機制模組」，新遊戲換定義、新機制加模組；整份定義可匯出 JSON（線上共用、版本控管的基礎）。
        </div>
      </div>
    </div>
  );
}

/* ====================== 試玩 ====================== */
function PlayPanel({ game }) {
  const samplerRef = useRef(buildSampler(game.weights));
  useMemo(() => { samplerRef.current = buildSampler(game.weights); }, [game.weights]);
  const fgFeat = useMemo(() => game.features.find((f) => f.type === "freeSpins"), [game.features]);

  const [board, setBoard] = useState(() => drawBoard(samplerRef.current));
  const [revealCols, setRevealCols] = useState(5);
  const [winCells, setWinCells] = useState(new Set());
  const [lastWin, setLastWin] = useState(0);
  const [tier, setTier] = useState(null);
  const [balance, setBalance] = useState(1000);
  const [spinning, setSpinning] = useState(false);
  const [fg, setFg] = useState(null);
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const runFG = useCallback((startSpins) => {
    if (!fgFeat) { setSpinning(false); return; }
    const p = fgFeat.params;
    let remaining = startSpins, total = 0, guard = 0;
    setFg({ remaining, total: 0, spinsTotal: startSpins });
    const step = () => {
      if (remaining <= 0 || guard > 200) {
        setSpinning(false); setBalance((x) => x + total);
        timers.current.push(setTimeout(() => setFg((f) => f && { ...f, done: true }), 200));
        return;
      }
      guard++; remaining--;
      const b = drawBoard(samplerRef.current); const det = evalDetailed(b, game); const sc = countScatter(b, game);
      let w = det.win * p.multiplier;
      if (sc >= 3) { w += (game.scatter.pays[Math.min(sc, 5)] || 0) * p.multiplier; if (p.retrigger) remaining += p.award[Math.min(sc, 5)]; }
      total += w; setBoard(b); setWinCells(det.cells);
      setFg({ remaining, total, spinsTotal: startSpins });
      timers.current.push(setTimeout(step, 420));
    };
    timers.current.push(setTimeout(step, 600));
  }, [fgFeat, game]);

  const finish = useCallback((b) => {
    const det = evalDetailed(b, game); const sc = countScatter(b, game); let scPay = 0;
    if (sc >= 3) { scPay = game.scatter.pays[Math.min(sc, 5)] || 0; for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) if (b[c][r] === "SCAT") det.cells.add(c + "-" + r); }
    const w = det.win + scPay; setWinCells(det.cells); setLastWin(w); setTier(winTier(w / BET)); setBalance((x) => x + w);
    if (sc >= 3 && fgFeat) runFG(fgFeat.params.award[Math.min(sc, 5)]); else setSpinning(false);
  }, [game, fgFeat, runFG]);

  const spin = useCallback(() => {
    if (spinning) return; clearTimers();
    setFg(null); setTier(null); setWinCells(new Set()); setLastWin(0); setSpinning(true); setBalance((x) => x - BET);
    const b = drawBoard(samplerRef.current); setRevealCols(0); setBoard(b);
    for (let c = 1; c <= 5; c++) timers.current.push(setTimeout(() => setRevealCols(c), c * 130));
    timers.current.push(setTimeout(() => finish(b), 5 * 130 + 120));
  }, [spinning, finish]);

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 16, marginTop: 18 }}>
      <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}`, position: "relative" }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
          {board.map((col, c) => (
            <div key={c} className="grid" style={{ gridTemplateRows: "repeat(3,1fr)", gap: 7, opacity: c < revealCols ? 1 : 0.12, transform: c < revealCols ? "none" : "translateY(-6px)", transition: "opacity .18s,transform .18s" }}>
              {col.map((s, r) => <Tile key={r} sym={s} win={winCells.has(c + "-" + r)} dim={winCells.size > 0 && !winCells.has(c + "-" + r)} />)}
            </div>
          ))}
        </div>
        {tier && !fg && <Overlay border={tier.c} title={tier.t} big sub={`+${lastWin.toFixed(2)}x`} />}
        {fg && <Overlay border={C.purple} title={fg.done ? "免費遊戲結束" : "免費遊戲"} sub={fg.done ? `共 ${fg.spinsTotal} 局` : `剩餘 ${fg.remaining} 局 · ×${fgFeat?.params.multiplier}`} value={`+${fg.total.toFixed(2)}x`} />}
      </div>
      <div className="flex" style={{ flexDirection: "column", gap: 12 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="餘額" value={balance.toFixed(0)} />
          <Stat label="上局贏分" value={(lastWin > 0 ? "+" : "") + lastWin.toFixed(2) + "x"} accent={lastWin > 0 ? C.value : C.faint} />
        </div>
        <button onClick={spin} disabled={spinning} className="flex items-center justify-center rounded-xl" style={{ gap: 8, padding: 16, fontSize: 18, fontWeight: 800, cursor: spinning ? "default" : "pointer", border: "none", background: spinning ? C.goldDim : C.gold, color: C.ink, opacity: spinning ? 0.7 : 1 }}>
          <Zap size={20} /> {spinning ? "轉動中…" : "SPIN（押注 1）"}
        </button>
        <button onClick={() => { clearTimers(); setBalance(1000); setFg(null); setTier(null); setWinCells(new Set()); setLastWin(0); setSpinning(false); setRevealCols(5); setBoard(drawBoard(samplerRef.current)); }} className="flex items-center justify-center rounded-lg" style={{ gap: 6, padding: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", color: C.dim, border: `1px solid ${C.line}` }}>
          <RotateCcw size={14} /> 重設餘額
        </button>
        <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>數值事件 → 表現層</div>
          {[["贏分 ≥ 5×", "BIG WIN", C.gold], ["贏分 ≥ 15×", "MEGA WIN", C.red], ["贏分 ≥ 50×", "EPIC WIN", C.purple], ["3+ 散佈", "進入免費遊戲", C.purple]].map(([cond, resp, col], i) => (
            <div key={i} className="flex items-center justify-between" style={{ fontSize: 12.5, padding: "3px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <span style={{ color: C.dim, fontFamily: MONO }}>{cond}</span><span style={{ color: col, fontWeight: 700 }}>{resp}</span>
            </div>
          ))}
          <div style={{ color: C.faint, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>慶祝分級、節奏、音效時點都由「數值門檻」驅動 — 這就是「表現服務數值」。（v1 無音效）</div>
        </div>
      </div>
    </div>
  );
}
function Overlay({ border, title, sub, value, big }) {
  return <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
    <div style={{ background: C.ink + "E0", border: `2px solid ${border}`, borderRadius: 14, padding: "14px 30px", textAlign: "center", boxShadow: `0 0 30px ${border}55` }}>
      <div style={{ color: border, fontWeight: 900, fontSize: big ? 30 : 22, letterSpacing: ".05em", fontFamily: MONO }}>{title}</div>
      {sub && <div style={{ color: C.dim, fontSize: 13, marginTop: 3 }}>{sub}</div>}
      {value && <div style={{ color: C.value, fontSize: 26, fontWeight: 800, marginTop: 6, fontFamily: MONO }}>{value}</div>}
    </div>
  </div>;
}

/* ====================== 數值實驗室 ====================== */
function LabPanel({ game, setGame, simRes, setSimRes }) {
  const [spins, setSpins] = useState(200000);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [session, setSession] = useState(null);

  const totalW = ALL_SYMS.reduce((s, k) => s + (game.weights[k] || 0), 0);
  const fgFeat = game.features.find((f) => f.type === "freeSpins");

  const setWeight = (k, v) => setGame((p) => ({ ...p, weights: { ...p.weights, [k]: Math.max(0, parseFloat(v) || 0) } }));
  const setPay = (sym, i, v) => setGame((p) => { const row = [...p.paytable[sym]]; row[i] = Math.max(0, parseFloat(v) || 0); return { ...p, paytable: { ...p.paytable, [sym]: row } }; });
  const setMult = (v) => setGame((p) => ({ ...p, features: p.features.map((f) => f.type === "freeSpins" ? { ...f, params: { ...f.params, multiplier: Math.max(1, parseFloat(v) || 1) } } : f) }));

  const runSim = useCallback(() => {
    setRunning(true); setProgress(0);
    const sampler = buildSampler(game.weights);
    const CHUNK = 25000; let done = 0;
    const a = { sumPay: 0, sumBase: 0, sumFeat: 0, sumSq: 0, hits: 0, trig: 0, maxWin: 0, perFeature: {}, perFeatureTrig: {} };
    const buckets = new Array(8).fill(0); const conv = []; const cstep = Math.max(1, Math.floor(spins / 120));
    const t0 = performance.now();
    const step = () => {
      const end = Math.min(done + CHUNK, spins);
      for (let i = done; i < end; i++) {
        const r = spinOnce(sampler, game);
        a.sumPay += r.total; a.sumBase += r.base; a.sumFeat += r.feature; a.sumSq += r.total * r.total;
        if (r.total > 0) a.hits++; if (r.triggered) a.trig++; if (r.total > a.maxWin) a.maxWin = r.total;
        for (const k in r.perFeature) { a.perFeature[k] = (a.perFeature[k] || 0) + r.perFeature[k]; a.perFeatureTrig[k] = (a.perFeatureTrig[k] || 0) + 1; }
        buckets[bucketIndex(r.total / BET)]++;
        if (i % cstep === 0) conv.push({ n: i + 1, rtp: (a.sumPay / ((i + 1) * BET)) * 100 });
      }
      done = end; setProgress(done / spins);
      if (done < spins) { setTimeout(step, 0); return; }
      setSimRes(finalizeRes(game, spins, a, buckets, conv, Math.round(performance.now() - t0)));
      setRunning(false);
    };
    setTimeout(step, 30);
  }, [game, spins, setSimRes]);

  const runSession = useCallback(() => {
    const sampler = buildSampler(game.weights); let bal = 200; const data = [{ spin: 0, bal }];
    for (let i = 1; i <= 500; i++) { bal -= BET; bal += spinOnce(sampler, game).total; data.push({ spin: i, bal: Math.max(bal, 0) }); if (bal <= 0) break; }
    setSession(data);
  }, [game]);

  const res = simRes; const featShare = res ? (res.rtpFeat / res.rtp) * 100 : 0;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,320px) minmax(0,1fr)", gap: 16 }}>
        {/* 左：設計輸入 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center" style={{ gap: 6, marginBottom: 10 }}>
              <Sparkles size={15} color={C.gold} /><span style={{ fontSize: 13, fontWeight: 800 }}>每軸符號權重</span>
              <span style={{ color: C.faint, fontSize: 11, marginLeft: "auto" }}>機率 = 權重 / 總和</span>
            </div>
            {ALL_SYMS.map((k) => (
              <div key={k} className="flex items-center" style={{ gap: 8, padding: "3px 0" }}>
                <span className="flex items-center justify-center rounded" style={{ width: 26, height: 22, background: META[k].bg, color: META[k].fg, fontSize: 11, fontWeight: 800, fontFamily: MONO, flexShrink: 0 }}>{META[k].label}</span>
                <input type="number" step="0.5" value={game.weights[k]} onChange={(e) => setWeight(k, e.target.value)} style={inp(58)} />
                <div style={{ flex: 1, height: 6, background: C.panel2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${((game.weights[k] || 0) / totalW) * 100}%`, height: "100%", background: META[k].bg }} /></div>
                <span style={{ color: C.dim, fontSize: 11, width: 44, textAlign: "right", fontFamily: MONO }}>{(((game.weights[k] || 0) / totalW) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>賠付表 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>（× 押注｜3/4/5 連）</span></div>
            <div className="grid" style={{ gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 6, alignItems: "center" }}>
              <div /><Hd>3</Hd><Hd>4</Hd><Hd>5</Hd>
              {PAYING.map((sym) => (
                <React.Fragment key={sym}>
                  <span className="flex items-center justify-center rounded" style={{ width: 26, height: 20, background: META[sym].bg, color: META[sym].fg, fontSize: 10, fontWeight: 800, fontFamily: MONO }}>{META[sym].label}</span>
                  {[0, 1, 2].map((i) => <input key={i} type="number" step="0.05" value={game.paytable[sym][i]} onChange={(e) => setPay(sym, i, e.target.value)} style={{ ...inp("100%"), textAlign: "right", fontSize: 12, padding: "3px 5px" }} />)}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 12, gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.dim }}>免費遊戲倍率 ×</span>
              <input type="number" step="1" value={fgFeat?.params.multiplier ?? 1} onChange={(e) => setMult(e.target.value)} style={{ ...inp(64), textAlign: "right" }} />
            </div>
          </div>
          <button onClick={() => setGame(DEFAULT_GAME)} className="flex items-center justify-center rounded-lg" style={{ gap: 6, padding: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: "transparent", color: C.dim, border: `1px solid ${C.line}` }}><RotateCcw size={13} /> 還原預設值</button>
        </div>

        {/* 右：執行 + 結果 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4 flex items-center" style={{ background: C.panel, border: `1px solid ${C.line}`, gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: C.dim }}>模擬局數</span>
            <div className="flex" style={{ gap: 6 }}>
              {[100000, 200000, 500000, 1000000].map((n) => <button key={n} onClick={() => setSpins(n)} disabled={running} className="rounded-md" style={{ padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: "none", background: spins === n ? C.teal : C.panel2, color: spins === n ? C.ink : C.dim, fontFamily: MONO }}>{n >= 1e6 ? "1M" : n / 1000 + "k"}</button>)}
            </div>
            <button onClick={runSim} disabled={running} className="flex items-center justify-center rounded-lg" style={{ marginLeft: "auto", gap: 7, padding: "9px 18px", fontSize: 14, fontWeight: 800, cursor: running ? "default" : "pointer", border: "none", background: C.teal, color: C.ink, opacity: running ? 0.7 : 1 }}>
              {running ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />} {running ? `模擬中 ${(progress * 100).toFixed(0)}%` : "套用並重新模擬"}
            </button>
          </div>

          {res && (
            <>
              <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                <Stat label="RTP（總計）" value={pct(res.rtp)} sub={`± ${(res.se * 100 * 1.96).toFixed(2)}% (95% CI)`} accent={C.value} />
                <Stat label="中獎率 / 空轉" value={pct(res.hitRate)} sub={`空轉 ${pct(1 - res.hitRate)}`} accent={C.teal} />
                <Stat label="Feature 佔 RTP" value={featShare.toFixed(1) + "%"} sub={`base ${pct(res.rtpBase)} / FG ${pct(res.rtpFeat)}`} accent={C.purple} />
                <Stat label="免費遊戲觸發" value={`1 / ${res.triggerOneIn.toFixed(0)}`} />
                <Stat label="波動 SD" value={res.sd.toFixed(2)} sub="每局贏分標準差" />
                <Stat label="最大單局贏分" value={res.maxWin.toFixed(0) + "x"} sub={`${(res.spins / 1000).toFixed(0)}k 局 · ${res.ms}ms`} accent={C.gold} />
              </div>
              <Card title="RTP 預算分配">
                <div className="flex" style={{ height: 26, borderRadius: 7, overflow: "hidden", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center justify-center" style={{ width: `${(res.rtpBase / res.rtp) * 100}%`, background: C.tealDim, fontSize: 11, fontWeight: 700, fontFamily: MONO }}>主遊戲 {pct(res.rtpBase)}</div>
                  <div className="flex items-center justify-center" style={{ width: `${(res.rtpFeat / res.rtp) * 100}%`, background: C.purpleDim, fontSize: 11, fontWeight: 700, fontFamily: MONO }}>免費遊戲 {pct(res.rtpFeat)}</div>
                </div>
              </Card>
              <Card title="倍數分佈（遊戲的「形狀」）" foot="紅 = 0x 空轉 · 青 = 一般 · 金 = 50x+ 大獎尾端">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={res.buckets} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11 }} stroke={C.line} /><YAxis tick={{ fill: C.dim, fontSize: 11 }} stroke={C.line} tickFormatter={(v) => v + "%"} />
                    <Tooltip contentStyle={tip()} formatter={(v) => [v.toFixed(3) + "%", "頻率"]} cursor={{ fill: C.line + "55" }} />
                    <Bar dataKey="pct" radius={[3, 3, 0, 0]}>{res.buckets.map((b) => <Cell key={b.idx} fill={b.idx === 0 ? C.red : b.idx >= 6 ? C.gold : C.teal} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="RTP 收斂曲線（為何需要大樣本）">
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={res.conv} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                    <XAxis dataKey="n" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} /><YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} tickFormatter={(v) => v.toFixed(0) + "%"} />
                    <Tooltip contentStyle={tip()} formatter={(v) => [v.toFixed(2) + "%", "累積 RTP"]} labelFormatter={(l) => l + " 局"} />
                    <ReferenceLine y={res.rtp * 100} stroke={C.gold} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="rtp" stroke={C.value} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card title="玩家旅程模擬（起始 200 · 押注 1 · 500 局）" action={<button onClick={runSession} className="flex items-center rounded-md" style={{ gap: 5, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: C.panel2, color: C.teal }}><Coins size={13} /> 抽一段</button>}>
                {session ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={session} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                      <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.gold} stopOpacity={0.4} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                      <XAxis dataKey="spin" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} /><YAxis tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} />
                      <Tooltip contentStyle={tip()} formatter={(v) => [v.toFixed(0), "餘額"]} labelFormatter={(l) => l + " 局"} />
                      <ReferenceLine y={200} stroke={C.faint} strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="bal" stroke={C.gold} strokeWidth={2} fill="url(#bg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: C.faint, fontSize: 12, padding: "20px 0", textAlign: "center" }}>按「抽一段」看單一玩家餘額曲線 — 同樣 RTP，每段體感差很多。</div>}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
const inp = (w) => ({ width: w, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 7px", fontSize: 13, fontFamily: MONO });
const tip = () => ({ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text });
function Hd({ children }) { return <div style={{ color: C.faint, fontSize: 10, textAlign: "center" }}>{children}</div>; }
function Card({ title, children, foot, action }) {
  return <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.dim }}>{title}</div>{action}
    </div>{children}
    {foot && <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>{foot}</div>}
  </div>;
}

/* ====================== 規格書 ====================== */
function SpecPanel({ game, setGame, simRes, goLab }) {
  const [manual, setManual] = useState({ vol: false, tail: false, hit: false, psych: false });
  const [jsonIn, setJsonIn] = useState("");
  const [copied, setCopied] = useState("");

  const setF = (k, v) => setGame((p) => ({ ...p, [k]: v }));
  const setFeatField = (id, k, v) => setGame((p) => ({ ...p, features: p.features.map((f) => f.id === id ? { ...f, [k]: v } : f) }));

  const res = simRes;
  const featShare = res ? (res.rtpFeat / res.rtp) * 100 : 0;
  const ciHalf = res ? res.se * 100 * 1.96 : 0;
  const rtpPct = res ? res.rtp * 100 : 0;
  const inBand = res && Math.abs(rtpPct - game.rtpTarget) <= game.rtpTolerance;
  const sampleOk = res && ciHalf <= game.rtpTolerance;
  const featuresHaveMetrics = res && game.features.every((f) => res.perFeature[f.id] !== undefined);

  // 組 Markdown
  const md = useMemo(() => {
    if (!res) return "（尚未模擬）";
    const L = [];
    L.push(`# ${game.name}`, `> ${game.tagline}`, ``);
    L.push(`## 核心描述`, `- 期待點：${game.expectation}`, `- 目標客群：${game.audience}`, `- 波動定位：${game.volatilityTarget}`, `- RTP 目標：${game.rtpTarget}% ± ${game.rtpTolerance}%`, `- 規格：${game.layout.reels}×${game.layout.rows} · ${game.layout.model} · 權重+RNG`, ``);
    L.push(`## 數值總表（模擬 ${(res.spins / 1000).toFixed(0)}k 局）`,
      `- RTP：${rtpPct.toFixed(2)}%（95% CI ±${ciHalf.toFixed(2)}%）`,
      `- 主遊戲 / 免費遊戲：${pct(res.rtpBase)} / ${pct(res.rtpFeat)}（feature 佔 ${featShare.toFixed(1)}%）`,
      `- 中獎率 / 空轉率：${pct(res.hitRate)} / ${pct(1 - res.hitRate)}`,
      `- 觸發率：1 / ${res.triggerOneIn.toFixed(0)}`,
      `- 波動 SD：${res.sd.toFixed(2)}　最大單局：${res.maxWin.toFixed(0)}x`,
      `- 倍數分佈：${res.buckets.map((b) => `${b.name} ${b.pct.toFixed(2)}%`).join("｜")}`, ``);
    L.push(`## 機制子規格`);
    game.features.forEach((f) => {
      const rc = res.perFeature[f.id] !== undefined ? (res.perFeature[f.id] * 100).toFixed(2) + "%" : "—";
      L.push(`### ${f.label}（${f.type}）`, `- 觸發條件：${f.trigger}`, `- 觸發率：1 / ${res.triggerOneIn.toFixed(0)}`, `- 對 RTP 貢獻：${rc}`,
        f.params.multiplier ? `- 倍率：×${f.params.multiplier}` : null, f.params.retrigger !== undefined ? `- 可再觸發：${f.params.retrigger ? "是" : "否"}` : null,
        `- 說明：${f.desc}`, ``);
    });
    L.push(`## 驗證`, `- [${inBand ? "x" : " "}] RTP 落在目標 ± 容差`, `- [${sampleOk ? "x" : " "}] 樣本足以在容差內定案（否則需 RD 大樣本）`, `- [${featuresHaveMetrics ? "x" : " "}] 每個機制都有子規格數值`, `- [${manual.vol ? "x" : " "}] 波動定位與體感一致`, `- [${manual.tail ? "x" : " "}] 倍數分佈尾端符合預期`, `- [${manual.hit ? "x" : " "}] 中獎率 / 空轉節奏 OK`, `- [${manual.psych ? "x" : " "}] 已做心理層 / 合規鉤子檢查（另立檢核）`);
    return L.filter((x) => x !== null).join("\n");
  }, [game, res, rtpPct, ciHalf, featShare, inBand, sampleOk, featuresHaveMetrics, manual]);

  const copy = (text, tag) => { try { navigator.clipboard?.writeText(text); } catch (e) {} setCopied(tag); setTimeout(() => setCopied(""), 1500); };
  const loadJson = () => { try { const g = JSON.parse(jsonIn); if (g && g.weights && g.paytable && g.features && g.scatter && g.layout) setGame(g); else alert("JSON 缺少必要欄位（weights / paytable / features / scatter / layout）"); } catch (e) { alert("JSON 解析失敗：" + e.message); } };

  if (!res) return <div className="rounded-xl p-8" style={{ marginTop: 18, background: C.panel, border: `1px dashed ${C.line}`, textAlign: "center", color: C.dim }}>尚未有模擬數據。<button onClick={goLab} style={{ color: C.teal, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>到數值實驗室</button>跑一次。</div>;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,360px)", gap: 16 }}>
        {/* 左：規格書本體 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>核心描述</SecTitle>
            <Field label="遊戲名稱" value={game.name} onChange={(v) => setF("name", v)} />
            <Field label="一句話特色 / fantasy" value={game.tagline} onChange={(v) => setF("tagline", v)} area />
            <Field label="期待點" value={game.expectation} onChange={(v) => setF("expectation", v)} area />
            <Field label="目標客群" value={game.audience} onChange={(v) => setF("audience", v)} area />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Field label="波動定位" value={game.volatilityTarget} onChange={(v) => setF("volatilityTarget", v)} />
              <Field label="RTP 目標 %" value={game.rtpTarget} onChange={(v) => setF("rtpTarget", parseFloat(v) || 0)} num />
              <Field label="容差 ±%" value={game.rtpTolerance} onChange={(v) => setF("rtpTolerance", parseFloat(v) || 0)} num />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>數值總表 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 自動帶入（模擬 {(res.spins / 1000).toFixed(0)}k）</span></SecTitle>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              <Mini label="RTP" value={rtpPct.toFixed(2) + "%"} sub={`目標 ${game.rtpTarget}±${game.rtpTolerance}`} ok={inBand} accent={C.value} />
              <Mini label="CI ±" value={ciHalf.toFixed(2) + "%"} sub="95% 信賴" ok={sampleOk} accent={C.text} />
              <Mini label="feature 佔" value={featShare.toFixed(1) + "%"} accent={C.purple} />
              <Mini label="中獎率" value={pct(res.hitRate)} sub={`空轉 ${pct(1 - res.hitRate)}`} accent={C.teal} />
              <Mini label="觸發" value={`1/${res.triggerOneIn.toFixed(0)}`} accent={C.text} />
              <Mini label="波動 / 最大" value={`${res.sd.toFixed(1)} / ${res.maxWin.toFixed(0)}x`} accent={C.gold} />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>機制子規格 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 每個機制一張，數值自動帶</span></SecTitle>
            {game.features.map((f) => (
              <div key={f.id} className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}`, marginBottom: 8 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
                  <Puzzle size={14} color={C.purple} /><span style={{ fontWeight: 800, fontSize: 14 }}>{f.label}</span>
                  <span style={{ color: C.faint, fontSize: 11, fontFamily: MONO }}>type: {f.type}</span>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 6 }}>
                  <Mini label="觸發" value={f.trigger} small />
                  <Mini label="觸發率" value={`1/${res.triggerOneIn.toFixed(0)}`} small accent={C.text} />
                  <Mini label="RTP 貢獻" value={res.perFeature[f.id] !== undefined ? (res.perFeature[f.id] * 100).toFixed(2) + "%" : "—"} small accent={C.purple} />
                  <Mini label="倍率 / retrig" value={`×${f.params.multiplier ?? "—"} / ${f.params.retrigger ? "可" : "不可"}`} small />
                </div>
                <Field label="說明" value={f.desc} onChange={(v) => setFeatField(f.id, "desc", v)} area />
              </div>
            ))}
            <div style={{ color: C.faint, fontSize: 11, lineHeight: 1.5 }}>新機制（sticky wild / hold & spin / cascade / 漸進式 JP …）= 引擎註冊一個模組 + 這裡自動多一張子規格。</div>
          </div>
        </div>

        {/* 右：驗證 + 匯出 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>驗證 checklist</SecTitle>
            <ChkAuto ok={inBand} label="RTP 落在目標 ± 容差" detail={`${rtpPct.toFixed(2)}% vs ${game.rtpTarget}±${game.rtpTolerance}%`} />
            <ChkAuto ok={sampleOk} warn label="樣本足以在容差內定案" detail={sampleOk ? "CI 在容差內" : `CI ±${ciHalf.toFixed(2)}% > 容差 — 需 RD 大樣本`} />
            <ChkAuto ok={featuresHaveMetrics} label="每個機制都有子規格數值" />
            <div style={{ height: 1, background: C.line, margin: "8px 0" }} />
            <ChkMan v={manual.vol} on={() => setManual((m) => ({ ...m, vol: !m.vol }))} label="波動定位與體感一致" />
            <ChkMan v={manual.tail} on={() => setManual((m) => ({ ...m, tail: !m.tail }))} label="倍數分佈尾端符合預期" />
            <ChkMan v={manual.hit} on={() => setManual((m) => ({ ...m, hit: !m.hit }))} label="中獎率 / 空轉節奏 OK" />
            <ChkMan v={manual.psych} on={() => setManual((m) => ({ ...m, psych: !m.psych }))} label="心理層 / 合規鉤子已檢查（另立檢核）" />
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>匯出 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 都在工具內，不另開檔</span></SecTitle>
            <button onClick={() => copy(md, "md")} className="flex items-center justify-center rounded-lg" style={{ width: "100%", gap: 6, padding: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: C.gold, color: C.ink, marginBottom: 8 }}>
              {copied === "md" ? <Check size={15} /> : <FileText size={15} />} {copied === "md" ? "已複製" : "複製規格書 Markdown"}
            </button>
            <textarea readOnly value={md} style={{ width: "100%", height: 130, background: C.panel2, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 10.5, fontFamily: MONO, resize: "vertical" }} />
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>遊戲定義 JSON <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 共用 / 版本控管</span></SecTitle>
            <button onClick={() => copy(JSON.stringify(game, null, 2), "json")} className="flex items-center justify-center rounded-lg" style={{ width: "100%", gap: 6, padding: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: "none", background: C.teal, color: C.ink, marginBottom: 8 }}>
              {copied === "json" ? <Check size={14} /> : <Download size={14} />} {copied === "json" ? "已複製" : "匯出目前遊戲定義"}
            </button>
            <textarea value={jsonIn} onChange={(e) => setJsonIn(e.target.value)} placeholder="貼上遊戲定義 JSON 以匯入…" style={{ width: "100%", height: 70, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 11, fontFamily: MONO, resize: "vertical" }} />
            <button onClick={loadJson} disabled={!jsonIn.trim()} className="rounded-lg" style={{ width: "100%", marginTop: 6, padding: 7, fontSize: 12, fontWeight: 700, cursor: jsonIn.trim() ? "pointer" : "default", border: `1px solid ${C.line}`, background: "transparent", color: jsonIn.trim() ? C.teal : C.faint }}>匯入並套用</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function SecTitle({ children }) { return <div style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>{children}</div>; }
function Field({ label, value, onChange, area, num }) {
  return <div style={{ marginBottom: 10 }}>
    <div style={{ color: C.dim, fontSize: 11, marginBottom: 3 }}>{label}</div>
    {area
      ? <textarea value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", minHeight: 38, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: "inherit", resize: "vertical", lineHeight: 1.4 }} />
      : <input type={num ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: num ? MONO : "inherit" }} />}
  </div>;
}
function Mini({ label, value, sub, ok, accent, small }) {
  return <div className="rounded-md" style={{ background: small ? "transparent" : C.panel2, border: small ? "none" : `1px solid ${C.line}`, padding: small ? "2px 0" : "7px 9px" }}>
    <div className="flex items-center" style={{ gap: 4 }}>
      <span style={{ color: C.faint, fontSize: 10, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</span>
      {ok !== undefined && (ok ? <Check size={11} color={C.green} /> : <AlertTriangle size={11} color={C.gold} />)}
    </div>
    <div style={{ color: accent || C.text, fontSize: small ? 12.5 : 16, fontWeight: 800, fontFamily: MONO, marginTop: 1, lineHeight: 1.15 }}>{value}</div>
    {sub && <div style={{ color: C.faint, fontSize: 9.5, marginTop: 1 }}>{sub}</div>}
  </div>;
}
function ChkAuto({ ok, label, detail, warn }) {
  const col = ok ? C.green : warn ? C.gold : C.red;
  return <div className="flex items-start" style={{ gap: 8, padding: "5px 0" }}>
    <div style={{ marginTop: 1 }}>{ok ? <Check size={15} color={col} /> : warn ? <AlertTriangle size={15} color={col} /> : <X size={15} color={col} />}</div>
    <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: C.text }}>{label}</div>{detail && <div style={{ fontSize: 10.5, color: C.faint, fontFamily: MONO }}>{detail}</div>}</div>
  </div>;
}
function ChkMan({ v, on, label }) {
  return <div onClick={on} className="flex items-center" style={{ gap: 8, padding: "5px 0", cursor: "pointer" }}>
    <div className="flex items-center justify-center rounded" style={{ width: 16, height: 16, border: `1.5px solid ${v ? C.teal : C.faint}`, background: v ? C.teal : "transparent" }}>{v && <Check size={11} color={C.ink} />}</div>
    <span style={{ fontSize: 12.5, color: v ? C.text : C.dim }}>{label}</span>
  </div>;
}
