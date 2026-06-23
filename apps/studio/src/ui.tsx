import React from "react";
import { Check, X, AlertTriangle } from "lucide-react";
import { C, MONO, meta } from "./theme";

/* ---------------- 盤面符號 ---------------- */
export function Tile({ sym, dim, win }: { sym: string; dim?: boolean; win?: boolean }) {
  const m = meta(sym);
  return (
    <div className="flex items-center justify-center rounded-md select-none" style={{
      background: m.bg, color: m.fg, width: "100%", aspectRatio: "1/1", fontWeight: 800,
      fontSize: "clamp(13px,3.2vw,22px)",
      boxShadow: win ? `0 0 0 2px ${C.gold},0 0 14px ${C.gold}66` : "none",
      opacity: dim ? 0.28 : 1, transition: "opacity .25s,box-shadow .2s", fontFamily: MONO,
    }}>{m.label}</div>
  );
}

/* ---------------- 固定 16:9 遊戲顯示區（統一框架）----------------
   任何遊戲都渲染進這個固定比例的舞台；盤面（reels×rows）自動置中縮放以塞進框內，
   換玩法 / 換盤面大小都不改變這個視窗的位置與比例。
   呼叫端只要提供 renderCell(c,r) 與（可選）overlay / revealCols。 */
const STAGE_BG = "radial-gradient(ellipse at 50% 35%, #1c2735 0%, #0b0f16 80%)";

export type ReelMode = "strip" | "cell" | "drop";

/** 一條捲動帶（向下捲動的 Tile 堆；doubled = 兩份相同符號做無縫循環）。 */
function ReelStripCol({ syms, blur, anticip }: { syms: string[]; blur: number; anticip: boolean }) {
  const doubled = syms.length ? [...syms, ...syms] : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", animation: `reel-roll ${anticip ? "0.55s" : "0.3s"} linear infinite`, filter: `blur(${blur}px)`, willChange: "transform" }}>
      {doubled.map((s, i) => <div key={i} style={{ flexShrink: 0 }}><Tile sym={s} /></div>)}
    </div>
  );
}

export function GameStage({ reels, rows, renderCell, overlay, revealCols, gap = "2.2%", spinningCols, landedCols, anticipationCols, reelStrip, settleMs = 160, reelMode = "strip" }: {
  reels: number;
  rows: number;
  renderCell: (c: number, r: number) => React.ReactNode;
  overlay?: React.ReactNode;
  revealCols?: number | null;
  gap?: string;
  spinningCols?: Set<number>;            // 仍在高速捲動的欄
  landedCols?: number;                   // 已落定欄數（取代 spin 期間的 revealCols）
  anticipationCols?: Set<number>;        // 預報強調（發光/慢轉）的欄
  reelStrip?: (c: number, r?: number) => string[]; // 捲動帶符號（cell 模式給每格不同）
  settleMs?: number;                     // 落定回彈時長（已吃 speed factor）
  reelMode?: ReelMode;                   // strip=整欄一條 / cell=每格獨立 / drop=掉落
}) {
  const wide = reels / rows >= 16 / 9; // 盤面比 16:9 寬 → 撐滿寬度；否則撐滿高度
  const landed = landedCols ?? revealCols ?? reels;
  const spinMode = spinningCols !== undefined || landedCols !== undefined;
  const strip = (c: number, r = 0) => (reelStrip ? reelStrip(c, r) : []);
  return (
    <div data-game-stage style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: STAGE_BG, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "4%", boxSizing: "border-box", boxShadow: "inset 0 0 70px #00000099" }}>
      <div style={{ aspectRatio: `${reels} / ${rows}`, width: wide ? "100%" : "auto", height: wide ? "auto" : "100%", display: "grid", gridTemplateColumns: `repeat(${reels}, 1fr)`, gap }}>
        {Array.from({ length: reels }).map((_, c) => {
          const anticip = anticipationCols?.has(c) ?? false;
          const glow = anticip ? { boxShadow: `0 0 0 2px ${C.gold}, 0 0 22px ${C.gold}99`, transform: "scale(1.02)" } : null;

          if (spinningCols?.has(c)) {
            if (reelMode === "strip") {
              return (
                <div key={"s" + c} style={{ overflow: "hidden", borderRadius: 8, transition: "box-shadow .2s", ...glow }}>
                  <ReelStripCol syms={strip(c)} blur={anticip ? 1 : 1.6} anticip={anticip} />
                </div>
              );
            }
            if (reelMode === "cell") {
              // 每格獨立小輪帶：用「width:100% + aspectRatio:1」的方框（與靜態 Tile 同尺寸），
              // 避免 1fr 列 + overflow 造成高度塌掉。
              return (
                <div key={"s" + c} style={{ display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gap, ...glow }}>
                  {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} style={{ minHeight: 0, minWidth: 0 }}>
                      <div style={{ width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 6 }}>
                        <ReelStripCol syms={strip(c, r)} blur={anticip ? 0.8 : 1.3} anticip={anticip} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            // drop 模式轉動期：暗格佔位（真正動作在落定時掉入）
            return (
              <div key={"s" + c} style={{ display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gap, opacity: 0.3, ...glow }}>
                {Array.from({ length: rows }).map((_, r) => <div key={r} style={{ background: C.panel2, borderRadius: 6 }} />)}
              </div>
            );
          }

          const shown = c < landed;
          // cell / drop 模式：落定在「每一格自己的方框內」進行（停輪、回彈、掉落都在格子裡，
          // 與轉動中的單格輪帶同尺寸方框，不會用整欄挪移或其他圖蓋下來）。
          if (spinMode && shown && (reelMode === "cell" || reelMode === "drop")) {
            return (
              <div key={"l" + c} style={{ display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gap }}>
                {Array.from({ length: rows }).map((_, r) => (
                  <div key={r} style={{ minHeight: 0, minWidth: 0 }}>
                    <div style={{ width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 6 }}>
                      <div style={{ animation: reelMode === "drop"
                        ? `reel-drop ${Math.round(settleMs * 1.8)}ms cubic-bezier(.34,.65,.4,1) ${r * 55}ms both`
                        : `reel-settle ${settleMs}ms ease-out` }}>
                        {renderCell(c, r)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          }
          // strip 模式落定（整欄回彈）或非轉動 / 未落定
          const settle = spinMode && shown && reelMode === "strip";
          return (
            <div key={(spinMode ? "l" : "g") + c} style={{ display: "grid", gridTemplateRows: `repeat(${rows}, 1fr)`, gap, opacity: shown ? 1 : 0.12, transform: shown ? "none" : "translateY(-6px)", transition: "opacity .18s, transform .18s", animation: settle ? `reel-settle ${settleMs}ms ease-out` : undefined }}>
              {Array.from({ length: rows }).map((_, r) => <div key={r} style={{ minHeight: 0, minWidth: 0 }}>{renderCell(c, r)}</div>)}
            </div>
          );
        })}
      </div>
      {overlay}
    </div>
  );
}

/* ---------------- 數值卡 ---------------- */
export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
      <div style={{ color: C.dim, fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: accent || C.text, fontSize: 24, fontWeight: 800, marginTop: 2, fontFamily: MONO, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ---------------- 試玩 banner ---------------- */
export function Overlay({ border, title, sub, value, big }: { border: string; title: string; sub?: string; value?: string; big?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ background: C.ink + "E0", border: `2px solid ${border}`, borderRadius: 14, padding: "14px 30px", textAlign: "center", boxShadow: `0 0 30px ${border}55` }}>
        <div style={{ color: border, fontWeight: 900, fontSize: big ? 30 : 22, letterSpacing: ".05em", fontFamily: MONO }}>{title}</div>
        {sub && <div style={{ color: C.dim, fontSize: 13, marginTop: 3 }}>{sub}</div>}
        {value && <div style={{ color: C.value, fontSize: 26, fontWeight: 800, marginTop: 6, fontFamily: MONO }}>{value}</div>}
      </div>
    </div>
  );
}

/* ---------------- 區塊卡 ---------------- */
export function Card({ title, children, foot, action }: { title: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.dim }}>{title}</div>{action}
      </div>
      {children}
      {foot && <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>{foot}</div>}
    </div>
  );
}

export function Hd({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.faint, fontSize: 10, textAlign: "center" }}>{children}</div>;
}

export const inp = (w: number | string): React.CSSProperties => ({
  width: w, background: C.panel2, color: C.text, border: `1px solid ${C.line}`,
  borderRadius: 6, padding: "4px 7px", fontSize: 13, fontFamily: MONO,
});

export const tip = (): React.CSSProperties => ({ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text });

export function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>{children}</div>;
}

/* ---------------- 規格書欄位 ---------------- */
export function Field({ label, value, onChange, area, num }: { label: string; value: React.ReactNode; onChange: (v: string) => void; area?: boolean; num?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: C.dim, fontSize: 11, marginBottom: 3 }}>{label}</div>
      {area
        ? <textarea value={value as string} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", minHeight: 38, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: "inherit", resize: "vertical", lineHeight: 1.4 }} />
        : <input type={num ? "number" : "text"} value={value as string | number} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: num ? MONO : "inherit" }} />}
    </div>
  );
}

export function Mini({ label, value, sub, ok, accent, small }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; ok?: boolean; accent?: string; small?: boolean }) {
  return (
    <div className="rounded-md" style={{ background: small ? "transparent" : C.panel2, border: small ? "none" : `1px solid ${C.line}`, padding: small ? "2px 0" : "7px 9px" }}>
      <div className="flex items-center" style={{ gap: 4 }}>
        <span style={{ color: C.faint, fontSize: 10, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</span>
        {ok !== undefined && (ok ? <Check size={11} color={C.green} /> : <AlertTriangle size={11} color={C.gold} />)}
      </div>
      <div style={{ color: accent || C.text, fontSize: small ? 12.5 : 16, fontWeight: 800, fontFamily: MONO, marginTop: 1, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ color: C.faint, fontSize: 9.5, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export function ChkAuto({ ok, label, detail, warn }: { ok?: boolean; label: string; detail?: React.ReactNode; warn?: boolean }) {
  const col = ok ? C.green : warn ? C.gold : C.red;
  return (
    <div className="flex items-start" style={{ gap: 8, padding: "5px 0" }}>
      <div style={{ marginTop: 1 }}>{ok ? <Check size={15} color={col} /> : warn ? <AlertTriangle size={15} color={col} /> : <X size={15} color={col} />}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: C.text }}>{label}</div>
        {detail && <div style={{ fontSize: 10.5, color: C.faint, fontFamily: MONO }}>{detail}</div>}
      </div>
    </div>
  );
}

export function ChkMan({ v, on, label }: { v: boolean; on: () => void; label: string }) {
  return (
    <div onClick={on} className="flex items-center" style={{ gap: 8, padding: "5px 0", cursor: "pointer" }}>
      <div className="flex items-center justify-center rounded" style={{ width: 16, height: 16, border: `1.5px solid ${v ? C.teal : C.faint}`, background: v ? C.teal : "transparent" }}>{v && <Check size={11} color={C.ink} />}</div>
      <span style={{ fontSize: 12.5, color: v ? C.text : C.dim }}>{label}</span>
    </div>
  );
}
