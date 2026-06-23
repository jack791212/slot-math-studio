/* 視覺主題與符號外觀 — 純表現層（不屬於引擎契約）。 */

export const C = {
  ink: "#0E1116", panel: "#161B22", panel2: "#1C232D", line: "#2A323D",
  text: "#E6EDF3", dim: "#8B97A7", faint: "#5A6675",
  gold: "#E8B339", goldDim: "#8a6a1f", value: "#F2C75C",
  teal: "#3FB6A8", tealDim: "#1f5a55", red: "#E5534B", purple: "#A371F7",
  green: "#3FB950", sky: "#4A9EE8", purpleDim: "#5b3fa0",
} as const;

export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export interface SymMeta { label: string; bg: string; fg: string; name: string }

/** 符號 → 視覺外觀。key 必須對應 game.symbols。 */
export const META: Record<string, SymMeta> = {
  WILD: { label: "W", bg: "#E8B339", fg: "#0E1116", name: "WILD（百搭）" },
  SCAT: { label: "★", bg: "#A371F7", fg: "#FFFFFF", name: "SCATTER（散佈）" },
  H1: { label: "H1", bg: "#C9433B", fg: "#FFFFFF", name: "高分 1" },
  H2: { label: "H2", bg: "#2E9E57", fg: "#FFFFFF", name: "高分 2" },
  H3: { label: "H3", bg: "#3A82C4", fg: "#FFFFFF", name: "高分 3" },
  L1: { label: "A", bg: "#39424E", fg: "#C7D0DB", name: "低分 A" },
  L2: { label: "K", bg: "#363F4A", fg: "#C7D0DB", name: "低分 K" },
  L3: { label: "Q", bg: "#333B46", fg: "#C7D0DB", name: "低分 Q" },
  L4: { label: "J", bg: "#2F3741", fg: "#C7D0DB", name: "低分 J" },
  // Hold & Spin 金幣（label 顯示面額；實際面額以 game.features 的 params.coins 為準）
  C1: { label: "1", bg: "#C9A227", fg: "#0E1116", name: "金幣 1" },
  C2: { label: "2", bg: "#D4AC2B", fg: "#0E1116", name: "金幣 2" },
  C5: { label: "5", bg: "#E8B339", fg: "#0E1116", name: "金幣 5" },
  CT: { label: "10", bg: "#F0BE4A", fg: "#0E1116", name: "金幣 10" },
  CG: { label: "30", bg: "#F2C75C", fg: "#3a2a06", name: "金幣 頂級" },
  JP: { label: "JP", bg: "#E5534B", fg: "#FFFFFF", name: "頭獎符號" },
};

/** 未在 META 登錄的符號給一個保底外觀，避免新遊戲符號讓 UI 崩。 */
export function meta(sym: string): SymMeta {
  return META[sym] ?? { label: sym.slice(0, 2), bg: "#39424E", fg: "#C7D0DB", name: sym };
}

export function winTier(m: number): { t: string; c: string } | null {
  if (m >= 50) return { t: "EPIC WIN", c: C.purple };
  if (m >= 15) return { t: "MEGA WIN", c: C.red };
  if (m >= 5) return { t: "BIG WIN", c: C.gold };
  return null;
}

export const pct = (x: number) => (x * 100).toFixed(2) + "%";
