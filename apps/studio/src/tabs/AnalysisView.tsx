import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Lightbulb } from "lucide-react";
import type { GameDefinition } from "@slot/engine";
import { C, MONO, pct } from "../theme";
import { Card, Stat, Mini, ChkAuto, tip } from "../ui";
import { recommendTests, type Analysis, type FeatureAnalysis } from "../sim/analysis";

export const ANALYZE_SEED = 20260617; // 固定種子 → 進階分析可重現

const KEY_LABEL: Record<string, string> = {
  coins: "金幣數", full: "填滿盤面率", rounds: "重抽輪數", spins: "免費局數", retriggers: "再觸發次數",
  wilds: "鎖定百搭數", endMult: "結束倍率", tier: "頭獎等級",
};
const keyLabel = (k: string) => KEY_LABEL[k] ?? k;
const oneIn = (x: number) => (Number.isFinite(x) ? `1 / ${Math.round(x).toLocaleString()}` : "未出現");

/** 逐遊戲測試建議（讀 game 定義產生）。 */
export function Recommendations({ game }: { game: GameDefinition }) {
  const recs = recommendTests(game);
  return (
    <Card title={<span className="flex items-center" style={{ gap: 6 }}><Lightbulb size={14} color={C.gold} /> 逐遊戲測試建議（依玩法自動產生）</span>}>
      <ul style={{ margin: 0, paddingLeft: 18, color: C.dim, fontSize: 12.5, lineHeight: 1.7 }}>
        {recs.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </Card>
  );
}

/** 進階分析結果（不變式 / 空轉 / 稀有度 / 各機制深度）。 */
export function AnalysisView({ analysis: res }: { analysis: Analysis }) {
  return (
    <>
      <Card title="不變式檢查（自動 QA）" foot={`分析 ${(res.spins / 1000).toFixed(0)}k 局 · ${res.ms}ms · 固定種子`}>
        {res.invariants.map((iv, i) => <ChkAuto key={i} ok={iv.ok} label={iv.name} detail={iv.detail} />)}
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
        <Card title="觸發間距 / 空轉分析（玩家體感）">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Mini label="最久未進 bonus" value={`${res.dry.maxNoTrigger.toLocaleString()} 局`} accent={C.red} sub="樣本內最長乾旱" />
            <Mini label="最長連續空轉" value={`${res.dry.maxNoWin.toLocaleString()} 局`} accent={C.gold} />
            <Mini label="觸發間距中位" value={`${res.dry.medianGap.toLocaleString()} 局`} />
            <Mini label="觸發間距 p90" value={`${res.dry.p90Gap.toLocaleString()} 局`} />
          </div>
        </Card>
        <Card title="大獎稀有度（× 押注）" foot={res.maxWinAtSpin >= 0 ? `最大單局 ${res.maxWin.toFixed(1)}x（第 ${(res.maxWinAtSpin + 1).toLocaleString()} 局）` : ""}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {res.rarity.map((r) => <Mini key={r.label} label={r.label} value={oneIn(r.oneIn)} accent={C.purple} />)}
          </div>
        </Card>
      </div>

      {res.cascade && (
        <Card title="連消鏈長分佈（cascade）" foot={`平均 ${res.cascade.mean.toFixed(2)} 連 · 最長 ${res.cascade.max} 連`}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={res.cascade.hist} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="v" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} />
              <YAxis tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} tickFormatter={(v: number) => v + "%"} />
              <Tooltip contentStyle={tip()} formatter={(v: any) => [Number(v).toFixed(2) + "%", "頻率"]} labelFormatter={(l: any) => `${l} 連`} cursor={{ fill: C.line + "55" }} />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]} fill={C.teal} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {res.features.map((f) => <FeatureCard key={f.id} f={f} />)}
    </>
  );
}

function FeatureCard({ f }: { f: FeatureAnalysis }) {
  return (
    <Card title={<span>機制深度分析 · <b style={{ color: C.purple }}>{f.label}</b> <span style={{ color: C.faint, fontWeight: 500, fontFamily: MONO }}>({f.type})</span></span>} foot={`觸發 ${oneIn(f.triggerOneIn)}　樣本 ${f.triggers.toLocaleString()} 次`}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 10 }}>
        <Mini label="平均贏分" value={f.winMean.toFixed(2) + "x"} accent={C.value} />
        <Mini label="中位 p50" value={f.winP50.toFixed(2) + "x"} />
        <Mini label="p90" value={f.winP90.toFixed(2) + "x"} />
        <Mini label="p99" value={f.winP99.toFixed(2) + "x"} accent={C.gold} />
        <Mini label="最大" value={f.winMax.toFixed(1) + "x"} accent={C.red} />
      </div>

      <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 4 }}>機制贏分分佈（× 押注）</div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={f.winBuckets} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} />
          <YAxis tick={{ fill: C.dim, fontSize: 10 }} stroke={C.line} tickFormatter={(v: number) => v + "%"} />
          <Tooltip contentStyle={tip()} formatter={(v: any) => [Number(v).toFixed(2) + "%", "頻率"]} cursor={{ fill: C.line + "55" }} />
          <Bar dataKey="pct" radius={[3, 3, 0, 0]}>{f.winBuckets.map((b, i) => <Cell key={i} fill={i >= 6 ? C.gold : C.purpleDim} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>

      {f.details.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(f.details.length, 3)},1fr)`, gap: 12, marginTop: 12 }}>
          {f.details.map((d) => (
            <div key={d.key}>
              {d.key === "full"
                ? <Mini label={keyLabel(d.key)} value={pct(d.mean)} accent={C.value} sub="觸發後填滿機率" />
                : <>
                    <Mini label={keyLabel(d.key)} value={`平均 ${d.mean.toFixed(2)}`} sub={`範圍 ${d.min}–${d.max}`} />
                    {d.hist.length > 1 && (
                      <ResponsiveContainer width="100%" height={90}>
                        <BarChart data={d.hist} margin={{ top: 6, right: 4, left: -18, bottom: -6 }}>
                          <XAxis dataKey="v" tick={{ fill: C.faint, fontSize: 9 }} stroke={C.line} />
                          <YAxis hide />
                          <Tooltip contentStyle={tip()} formatter={(v: any) => [Number(v).toFixed(1) + "%", keyLabel(d.key)]} labelFormatter={(l: any) => `${keyLabel(d.key)} = ${l}`} cursor={{ fill: C.line + "55" }} />
                          <Bar dataKey="pct" radius={[2, 2, 0, 0]} fill={C.teal} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
