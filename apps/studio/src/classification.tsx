/* 玩法三軸分類 — studio 表現層（讀引擎的 taxonomy 目錄，把遊戲標記渲染成 chip / 卡片 / 百科）。 */
import { useState } from "react";
import { ChevronRight, Layers, Sparkles, Wrench } from "lucide-react";
import {
  TAXONOMY, AXES, taxonomyEntry, byAxis,
  type GameDefinition, type FeatureDef, type TaxonomyEntry, type Axis,
} from "@slot/engine";
import { C, MONO } from "./theme";

/* ── 軸 → 顏色 / 圖示 ───────────────────────────────────────── */
export const AXIS_COLOR: Record<Axis, string> = { pay: C.teal, mode: C.gold, mechanic: C.purple };
export const AXIS_ICON: Record<Axis, typeof Layers> = { pay: Layers, mode: Sparkles, mechanic: Wrench };

/* ── 把一個遊戲拆成三軸的條目 ───────────────────────────────── */
export interface GameClass {
  pay?: TaxonomyEntry;
  modes: { feature: FeatureDef; entry?: TaxonomyEntry }[];
  mechanics: { key: string; entry?: TaxonomyEntry; label?: string }[];
}

export function gameClassification(game: GameDefinition): GameClass {
  const pay = taxonomyEntry(game.payMechanic ?? "ways");
  const modes = game.features
    .filter((f) => f.category === "mode")
    .map((f) => ({ feature: f, entry: f.taxonomyKey ? taxonomyEntry(f.taxonomyKey) : undefined }));
  // 機制來自兩處：標 category="mechanic" 的 feature + game.mechanics[]（如 cascade），去重。
  const seen = new Set<string>();
  const mechanics: GameClass["mechanics"] = [];
  for (const f of game.features) {
    if (f.category === "mechanic" && f.taxonomyKey && !seen.has(f.taxonomyKey)) {
      seen.add(f.taxonomyKey);
      mechanics.push({ key: f.taxonomyKey, entry: taxonomyEntry(f.taxonomyKey), label: f.label });
    }
  }
  for (const k of game.mechanics ?? []) {
    if (!seen.has(k)) { seen.add(k); mechanics.push({ key: k, entry: taxonomyEntry(k) }); }
  }
  return { pay, modes, mechanics };
}

/* ── chip ───────────────────────────────────────────────────── */
function Chip({ axis, label, title }: { axis: Axis; label: string; title?: string }) {
  const col = AXIS_COLOR[axis];
  const Icon = AXIS_ICON[axis];
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, lineHeight: 1.5, cursor: title ? "help" : "default",
      color: col, background: col + "1c", border: `1px solid ${col}55`, fontFamily: MONO,
    }}>
      <Icon size={11} /> {label}
    </span>
  );
}

/** 標題列用的精簡三軸 chip 群（贏分方式 + 各模式 + 各機制）。 */
export function AxisTags({ game }: { game: GameDefinition }) {
  const k = gameClassification(game);
  return (
    <span className="flex items-center" style={{ gap: 6, flexWrap: "wrap" }}>
      {k.pay && <Chip axis="pay" label={k.pay.nameZH} title={`贏分方式：${k.pay.definition}`} />}
      {k.modes.map((m) => (
        <Chip key={m.feature.id} axis="mode" label={m.entry?.nameZH ?? m.feature.label} title={`玩法模式：${m.entry?.definition ?? m.feature.desc}`} />
      ))}
      {k.mechanics.map((m) => (
        <Chip key={m.key} axis="mechanic" label={m.entry?.nameZH ?? m.label ?? m.key} title={`遊戲機制：${m.entry?.definition ?? ""}`} />
      ))}
    </span>
  );
}

/* ── 單一條目卡（含數值槓桿 / 波動 / 怎麼測）────────────────── */
export function MechanicCard({ entry, axis, fallbackLabel }: { entry?: TaxonomyEntry; axis: Axis; fallbackLabel?: string }) {
  const col = AXIS_COLOR[axis];
  if (!entry) return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{fallbackLabel}</span>
      <span style={{ color: C.faint, fontSize: 11, marginLeft: 8 }}>（未在分類目錄登錄）</span>
    </div>
  );
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", borderLeft: `3px solid ${col}` }}>
      <div className="flex items-center" style={{ gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{entry.nameZH}</span>
        <span style={{ color: C.faint, fontSize: 11, fontFamily: MONO }}>{entry.nameEN}</span>
        {entry.implemented
          ? <span style={{ color: C.green, fontSize: 10, fontWeight: 700, border: `1px solid ${C.green}55`, borderRadius: 4, padding: "0 5px" }}>引擎已模擬</span>
          : <span style={{ color: C.faint, fontSize: 10, fontWeight: 700, border: `1px solid ${C.line}`, borderRadius: 4, padding: "0 5px" }}>規劃中</span>}
      </div>
      <div style={{ color: C.dim, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{entry.definition}</div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
        <Kv label="數值槓桿" v={entry.mathLevers} />
        <Kv label="波動" v={entry.volatility} />
        <Kv label="怎麼測" v={entry.howToTest} span />
      </div>
    </div>
  );
}
function Kv({ label, v, span }: { label: string; v: string; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <div style={{ color: C.faint, fontSize: 10, fontWeight: 700, letterSpacing: ".03em" }}>{label}</div>
      <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.45 }}>{v}</div>
    </div>
  );
}

/* ── 遊戲三軸明細（給規格書 / 實驗室用）────────────────────── */
export function ClassificationBreakdown({ game }: { game: GameDefinition }) {
  const k = gameClassification(game);
  return (
    <div className="flex" style={{ flexDirection: "column", gap: 10 }}>
      <AxisGroup axis="pay" title="贏分方式" entries={k.pay ? [{ entry: k.pay }] : []} empty="未指定（預設路數）" />
      <AxisGroup axis="mode" title="玩法模式" entries={k.modes.map((m) => ({ entry: m.entry, fallback: m.feature.label }))} empty="無（純 base 遊戲）" />
      <AxisGroup axis="mechanic" title="遊戲機制" entries={k.mechanics.map((m) => ({ entry: m.entry, fallback: m.label ?? m.key }))} empty="無額外修飾" />
    </div>
  );
}
function AxisGroup({ axis, title, entries, empty }: { axis: Axis; title: string; entries: { entry?: TaxonomyEntry; fallback?: string }[]; empty: string }) {
  const col = AXIS_COLOR[axis]; const Icon = AXIS_ICON[axis];
  return (
    <div>
      <div className="flex items-center" style={{ gap: 6, marginBottom: 5 }}>
        <Icon size={13} color={col} />
        <span style={{ fontWeight: 800, fontSize: 12.5, color: col }}>{title}</span>
        <span style={{ color: C.faint, fontSize: 11 }}>{AXES.find((a) => a.id === axis)?.nameEN}</span>
      </div>
      {entries.length === 0
        ? <div style={{ color: C.faint, fontSize: 12, paddingLeft: 19 }}>{empty}</div>
        : <div className="flex" style={{ flexDirection: "column", gap: 6 }}>
            {entries.map((e, i) => <MechanicCard key={i} entry={e.entry} axis={axis} fallbackLabel={e.fallback} />)}
          </div>}
    </div>
  );
}

/* ── 分類百科（競品調查整理，可折疊；highlight 目前遊戲用到的條目）──────── */
export function TaxonomyCatalog({ highlightKeys = [] }: { highlightKeys?: string[] }) {
  const [open, setOpen] = useState(false);
  const [axis, setAxis] = useState<Axis>("pay");
  const hi = new Set(highlightKeys);
  const list = byAxis(axis);
  const used = list.filter((e) => hi.has(e.key)).length;
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center" style={{ gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", color: C.text, padding: 0 }}>
        <ChevronRight size={16} color={C.dim} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        <span style={{ fontWeight: 800, fontSize: 14 }}>玩法分類百科</span>
        <span style={{ color: C.faint, fontSize: 11 }}>· 競品/媒體調查整理（{TAXONOMY.length} 項）</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div className="flex" style={{ gap: 6, marginBottom: 10 }}>
            {AXES.map((a) => {
              const on = axis === a.id; const col = AXIS_COLOR[a.id];
              return (
                <button key={a.id} onClick={() => setAxis(a.id)} style={{
                  flex: 1, padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  border: `1px solid ${on ? col : C.line}`, background: on ? col + "1c" : "transparent", color: on ? col : C.dim,
                }}>
                  {a.nameZH} <span style={{ fontSize: 10, opacity: 0.7 }}>{byAxis(a.id).length}</span>
                </button>
              );
            })}
          </div>
          <div style={{ color: C.faint, fontSize: 11.5, lineHeight: 1.5, marginBottom: 8 }}>
            {AXES.find((a) => a.id === axis)?.desc}
            {used > 0 && <span style={{ color: AXIS_COLOR[axis], fontWeight: 700 }}>　· 目前遊戲用到 {used} 項（高亮）</span>}
          </div>
          <div className="flex" style={{ flexDirection: "column", gap: 6 }}>
            {list.map((e) => <CatalogRow key={e.key} entry={e} axis={axis} highlighted={hi.has(e.key)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
function CatalogRow({ entry, axis, highlighted }: { entry: TaxonomyEntry; axis: Axis; highlighted: boolean }) {
  const [open, setOpen] = useState(false);
  const col = AXIS_COLOR[axis];
  const prevC = entry.prevalence === "core" ? C.gold : entry.prevalence === "common" ? C.teal : C.faint;
  return (
    <div style={{ background: highlighted ? col + "12" : C.panel2, border: `1px solid ${highlighted ? col + "66" : C.line}`, borderRadius: 8 }}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center" style={{ gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", color: C.text, padding: "8px 10px", textAlign: "left" }}>
        <ChevronRight size={14} color={C.faint} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>{entry.nameZH}</span>
        <span style={{ color: C.faint, fontSize: 10.5, fontFamily: MONO }}>{entry.nameEN}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={{ color: prevC, fontSize: 10, fontWeight: 700 }}>{entry.prevalence}</span>
          {entry.implemented && <span style={{ color: C.green, fontSize: 9.5, fontWeight: 700, border: `1px solid ${C.green}55`, borderRadius: 4, padding: "0 4px" }}>已模擬</span>}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 10px 10px 32px" }}>
          {entry.aka && <div style={{ color: C.faint, fontSize: 10.5, marginBottom: 4, fontFamily: MONO }}>aka: {entry.aka}</div>}
          <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.5 }}>{entry.definition}</div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
            <Kv label="數值槓桿（RTP）" v={entry.mathLevers} />
            <Kv label="波動" v={entry.volatility} />
            <Kv label="怎麼測（工具指標）" v={entry.howToTest} span />
            {entry.examples && <Kv label="範例" v={entry.examples} span />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 規格書 markdown 用：把分類轉成文字段落 ───────────────── */
export function classificationMarkdown(game: GameDefinition): string {
  const k = gameClassification(game);
  const L: string[] = ["## 玩法分類（三軸）"];
  L.push(`- **贏分方式**：${k.pay ? `${k.pay.nameZH}（${k.pay.nameEN}）— ${k.pay.definition}` : "未指定"}`);
  L.push(`- **玩法模式**：${k.modes.length ? k.modes.map((m) => m.entry?.nameZH ?? m.feature.label).join("、") : "無"}`);
  L.push(`- **遊戲機制**：${k.mechanics.length ? k.mechanics.map((m) => m.entry?.nameZH ?? m.label ?? m.key).join("、") : "無"}`);
  return L.join("\n");
}
