import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, AreaChart, Area, Cell,
} from "recharts";
import { Sparkles, FlaskConical, Loader2, RotateCcw, Coins, ClipboardCheck } from "lucide-react";
import { DEFAULT_GAME, GAMES, type GameDefinition } from "@slot/engine";
import { C, MONO, meta, pct } from "../theme";
import { Stat, Card, Hd, inp, tip } from "../ui";
import { runSession } from "../sim/harness";
import type { UseSimulation } from "../sim/useSimulation";
import { useAnalysis } from "../sim/useAnalysis";
import { AnalysisView, Recommendations, ANALYZE_SEED } from "./AnalysisView";

interface Props {
  game: GameDefinition;
  setGame: Dispatch<SetStateAction<GameDefinition>>;
  sim: UseSimulation;
}

// 模擬局數 slider：對數刻度（10k–2M）+ snap 到漂亮刻度。
const SPIN_MIN = 10_000, SPIN_MAX = 2_000_000;
const NICE = [10e3, 20e3, 50e3, 100e3, 200e3, 500e3, 1e6, 2e6];
const lg = Math.log10;
const snapNice = (v: number) => NICE.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const toSpins = (t: number) => snapNice(Math.pow(10, lg(SPIN_MIN) + (t / 1000) * (lg(SPIN_MAX) - lg(SPIN_MIN))));
const toSlider = (s: number) => Math.round(((lg(s) - lg(SPIN_MIN)) / (lg(SPIN_MAX) - lg(SPIN_MIN))) * 1000);
const fmtSpins = (n: number) => (n >= 1e6 ? n / 1e6 + "M" : n >= 1e3 ? n / 1e3 + "k" : String(n));

export function LabPanel({ game, setGame, sim }: Props) {
  const [spins, setSpins] = useState(200000);
  const [session, setSession] = useState<{ spin: number; bal: number }[] | null>(null);

  const ALL_SYMS = game.symbols;
  const PAYING = game.paying;
  const totalW = ALL_SYMS.reduce((s, k) => s + (game.weights[k] || 0), 0);

  const setWeight = (k: string, v: string) => setGame((p) => ({ ...p, weights: { ...p.weights, [k]: Math.max(0, parseFloat(v) || 0) } }));
  const setPay = (sym: string, i: number, v: string) => setGame((p) => { const row = [...p.paytable[sym]]; row[i] = Math.max(0, parseFloat(v) || 0); return { ...p, paytable: { ...p.paytable, [sym]: row } }; });
  const setFeatParam = (id: string, key: string, v: number) => setGame((p) => ({ ...p, features: p.features.map((f) => f.id === id ? { ...f, params: { ...f.params, [key]: v } } : f) }));
  const setCoinValue = (id: string, coin: string, v: number) => setGame((p) => ({ ...p, features: p.features.map((f) => f.id === id ? { ...f, params: { ...f.params, coins: { ...f.params.coins, [coin]: v } } } : f) }));
  const setTierValue = (id: string, idx: number, v: number) => setGame((p) => ({ ...p, features: p.features.map((f) => f.id === id ? { ...f, params: { ...f.params, tiers: f.params.tiers.map((t: any, i: number) => i === idx ? { ...t, value: v } : t) } } : f) }));
  const setCascadeMult = (idx: number, v: number) => setGame((p) => p.cascade ? { ...p, cascade: { ...p.cascade, multipliers: p.cascade.multipliers.map((m, i) => i === idx ? v : m) } } : p);
  const resetGame = () => setGame(GAMES.find((g) => g.id === game.id) ?? DEFAULT_GAME);

  const runSim = useCallback(() => { sim.run(game, spins); }, [sim, game, spins]);
  const drawSession = useCallback(() => { setSession(runSession(game, Math.random)); }, [game]);

  const analysis = useAnalysis();
  const runAnalysis = useCallback(() => { analysis.run(game, spins, ANALYZE_SEED); }, [analysis, game, spins]);

  const res = sim.res;
  const { running, progress } = sim;
  const featShare = res ? (res.rtpFeat / res.rtp) * 100 : 0;

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
                <span className="flex items-center justify-center rounded" style={{ width: 26, height: 22, background: meta(k).bg, color: meta(k).fg, fontSize: 11, fontWeight: 800, fontFamily: MONO, flexShrink: 0 }}>{meta(k).label}</span>
                <input type="number" step="0.5" value={game.weights[k] ?? 0} onChange={(e) => setWeight(k, e.target.value)} style={inp(58)} />
                <div style={{ flex: 1, height: 6, background: C.panel2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${((game.weights[k] || 0) / totalW) * 100}%`, height: "100%", background: meta(k).bg }} /></div>
                <span style={{ color: C.dim, fontSize: 11, width: 44, textAlign: "right", fontFamily: MONO }}>{(((game.weights[k] || 0) / totalW) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>賠付表 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>（× 押注｜3/4/5 連）</span></div>
            <div className="grid" style={{ gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 6, alignItems: "center" }}>
              <div /><Hd>3</Hd><Hd>4</Hd><Hd>5</Hd>
              {PAYING.map((sym) => (
                <div key={sym} style={{ display: "contents" }}>
                  <span className="flex items-center justify-center rounded" style={{ width: 26, height: 20, background: meta(sym).bg, color: meta(sym).fg, fontSize: 10, fontWeight: 800, fontFamily: MONO }}>{meta(sym).label}</span>
                  {[0, 1, 2].map((i) => <input key={i} type="number" step="0.05" value={game.paytable[sym][i]} onChange={(e) => setPay(sym, i, e.target.value)} style={{ ...inp("100%"), textAlign: "right", fontSize: 12, padding: "3px 5px" }} />)}
                </div>
              ))}
            </div>
          </div>

          {/* 機制參數 — 依機制 type 顯示對應旋鈕 */}
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>機制參數</div>
            {game.features.length === 0 && <div style={{ color: C.faint, fontSize: 12 }}>此遊戲無附加機制。</div>}
            {game.features.map((f) => (
              <div key={f.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 4 }}>{f.label} <span style={{ color: C.faint, fontWeight: 500, fontFamily: MONO }}>· {f.type}</span></div>

                {f.type === "freeSpins" && (
                  <div className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: C.dim }}>贏分倍率 ×</span>
                    <input type="number" step="1" value={f.params.multiplier ?? 1} onChange={(e) => setFeatParam(f.id, "multiplier", Math.max(1, parseFloat(e.target.value) || 1))} style={{ ...inp(64), textAlign: "right" }} />
                  </div>
                )}

                {f.type === "holdAndSpin" && (
                  <div className="flex" style={{ flexDirection: "column", gap: 6 }}>
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: C.dim }}>重抽次數</span>
                      <input type="number" step="1" value={f.params.respins ?? 3} onChange={(e) => setFeatParam(f.id, "respins", Math.max(1, Math.round(parseFloat(e.target.value) || 1)))} style={{ ...inp(64), textAlign: "right" }} />
                    </div>
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: C.dim }}>重抽落幣機率</span>
                      <input type="number" step="0.005" value={f.params.respinCoinChance ?? 0.1} onChange={(e) => setFeatParam(f.id, "respinCoinChance", Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)))} style={{ ...inp(64), textAlign: "right" }} />
                    </div>
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: C.dim }}>填滿盤面加給</span>
                      <input type="number" step="10" value={f.params.fullScreenBonus ?? 0} onChange={(e) => setFeatParam(f.id, "fullScreenBonus", Math.max(0, parseFloat(e.target.value) || 0))} style={{ ...inp(64), textAlign: "right" }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>金幣面額（× 押注）</div>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                      {Object.keys(f.params.coins ?? {}).map((coin) => (
                        <div key={coin} className="flex items-center" style={{ flexDirection: "column", gap: 2 }}>
                          <span className="flex items-center justify-center rounded" style={{ width: 24, height: 18, background: meta(coin).bg, color: meta(coin).fg, fontSize: 10, fontWeight: 800, fontFamily: MONO }}>{meta(coin).label}</span>
                          <input type="number" step="1" value={f.params.coins[coin]} onChange={(e) => setCoinValue(f.id, coin, Math.max(0, parseFloat(e.target.value) || 0))} style={{ ...inp("100%"), textAlign: "right", fontSize: 11, padding: "3px 4px" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {f.type === "freeSpinsCascade" && (
                  <div className="flex" style={{ flexDirection: "column", gap: 6 }}>
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: C.dim }}>起始倍率</span>
                      <input type="number" step="1" value={f.params.startMult ?? 1} onChange={(e) => setFeatParam(f.id, "startMult", Math.max(1, parseFloat(e.target.value) || 1))} style={{ ...inp(64), textAlign: "right" }} />
                    </div>
                    <div className="flex items-center justify-between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: C.dim }}>每次連消 +倍率</span>
                      <input type="number" step="1" value={f.params.multStep ?? 1} onChange={(e) => setFeatParam(f.id, "multStep", Math.max(0, parseFloat(e.target.value) || 0))} style={{ ...inp(64), textAlign: "right" }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.faint }}>免費局內倍率全程累積、不重置。</div>
                  </div>
                )}

                {f.type === "stickyWild" && (
                  <div className="flex items-center justify-between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: C.dim }}>重抽次數（固定）</span>
                    <input type="number" step="1" value={f.params.respins ?? 5} onChange={(e) => setFeatParam(f.id, "respins", Math.max(1, Math.round(parseFloat(e.target.value) || 1)))} style={{ ...inp(64), textAlign: "right" }} />
                  </div>
                )}

                {f.type === "jackpot" && f.params.tiers && (
                  <div className="flex" style={{ flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 11, color: C.faint }}>頭獎面額（× 押注）</div>
                    {f.params.tiers.map((t: { value: number; weight: number }, i: number) => (
                      <div key={i} className="flex items-center justify-between" style={{ gap: 8 }}>
                        <span style={{ fontSize: 12, color: C.dim }}>{(["mini", "minor", "major", "grand"][i] ?? `tier ${i}`)}（權重 {t.weight}）</span>
                        <input type="number" step="5" value={t.value} onChange={(e) => setTierValue(f.id, i, Math.max(0, parseFloat(e.target.value) || 0))} style={{ ...inp(72), textAlign: "right" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {game.cascade && (
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>連消倍率階梯 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 連續第 n 次連消</span></div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${game.cascade.multipliers.length},1fr)`, gap: 6 }}>
                {game.cascade.multipliers.map((m, i) => (
                  <div key={i} className="flex items-center" style={{ flexDirection: "column", gap: 2 }}>
                    <span style={{ color: C.faint, fontSize: 10 }}>{i + 1}{i === game.cascade!.multipliers.length - 1 ? "+" : ""}</span>
                    <input type="number" step="1" value={m} onChange={(e) => setCascadeMult(i, Math.max(1, parseFloat(e.target.value) || 1))} style={{ ...inp("100%"), textAlign: "right", fontSize: 12, padding: "3px 4px" }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>超過階梯長度沿用最後一格；base 每局重置（免費局用全程倍率）。</div>
            </div>
          )}

          <button onClick={resetGame} className="flex items-center justify-center rounded-lg" style={{ gap: 6, padding: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: "transparent", color: C.dim, border: `1px solid ${C.line}` }}><RotateCcw size={13} /> 還原此遊戲預設值</button>
        </div>

        {/* 右：執行 + 結果 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4 flex items-center" style={{ background: C.panel, border: `1px solid ${C.line}`, gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: C.dim }}>模擬局數</span>
            <div className="flex items-center" style={{ gap: 10, flex: 1, minWidth: 200 }}>
              <input type="range" min={0} max={1000} step={1} disabled={running} value={toSlider(spins)} onChange={(e) => setSpins(toSpins(+e.target.value))} style={{ flex: 1, accentColor: C.teal, cursor: running ? "default" : "pointer", opacity: running ? 0.5 : 1 }} />
              <span style={{ fontFamily: MONO, fontWeight: 800, color: C.teal, width: 52, textAlign: "right" }}>{fmtSpins(spins)}</span>
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
                    <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11 }} stroke={C.line} /><YAxis tick={{ fill: C.dim, fontSize: 11 }} stroke={C.line} tickFormatter={(v: number) => v + "%"} />
                    <Tooltip contentStyle={tip()} formatter={(v: any) => [Number(v).toFixed(3) + "%", "頻率"]} cursor={{ fill: C.line + "55" }} />
                    <Bar dataKey="pct" radius={[3, 3, 0, 0]}>{res.buckets.map((b) => <Cell key={b.idx} fill={b.idx === 0 ? C.red : b.idx >= 6 ? C.gold : C.teal} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="RTP 收斂曲線（為何需要大樣本）">
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={res.conv} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                    <XAxis dataKey="n" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} /><YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} tickFormatter={(v: number) => v.toFixed(0) + "%"} />
                    <Tooltip contentStyle={tip()} formatter={(v: any) => [Number(v).toFixed(2) + "%", "累積 RTP"]} labelFormatter={(l: any) => l + " 局"} />
                    <ReferenceLine y={res.rtp * 100} stroke={C.gold} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="rtp" stroke={C.value} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card title="玩家旅程模擬（起始 200 · 押注 1 · 500 局）" action={<button onClick={drawSession} className="flex items-center rounded-md" style={{ gap: 5, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: C.panel2, color: C.teal }}><Coins size={13} /> 抽一段</button>}>
                {session ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={session} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                      <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.gold} stopOpacity={0.4} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                      <XAxis dataKey="spin" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} /><YAxis tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} />
                      <Tooltip contentStyle={tip()} formatter={(v: any) => [Number(v).toFixed(0), "餘額"]} labelFormatter={(l: any) => l + " 局"} />
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

      {/* 進階分析 / QA — 跑出手動玩碰不到的分佈與邊界 */}
      <div className="flex" style={{ flexDirection: "column", gap: 14, marginTop: 14 }}>
        <div className="rounded-xl p-4 flex items-center" style={{ background: C.panel, border: `1px solid ${C.line}`, gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>進階分析 / QA</span>
          <span style={{ color: C.faint, fontSize: 11 }}>機制分佈 · 不變式 · 空轉/觸發間距 · 大獎稀有度 · {(spins / 1000).toFixed(0)}k 局 · 固定種子</span>
          <button onClick={runAnalysis} disabled={analysis.running} className="flex items-center justify-center rounded-lg" style={{ marginLeft: "auto", gap: 7, padding: "9px 18px", fontSize: 14, fontWeight: 800, cursor: analysis.running ? "default" : "pointer", border: "none", background: C.purple, color: "#fff", opacity: analysis.running ? 0.7 : 1 }}>
            {analysis.running ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />} {analysis.running ? `分析中 ${(analysis.progress * 100).toFixed(0)}%` : "跑進階分析"}
          </button>
        </div>
        <Recommendations game={game} />
        {analysis.res && <AnalysisView analysis={analysis.res} />}
      </div>
    </div>
  );
}
