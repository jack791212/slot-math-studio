import type { SimResult } from "@slot/engine";

/**
 * 設計用模擬的擴充結果：在引擎標準 SimResult 之上，加上 studio 表現層才需要的
 * 三個欄位（耗時、各機制觸發次數、RTP 收斂取樣）。這些是 harness 的職責，
 * 不屬於引擎核心數值。
 */
export interface RichSimResult extends SimResult {
  ms: number;
  perFeatureTrig: Record<string, number>;
  conv: { n: number; rtp: number }[];
}

export type WorkerOut =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; res: RichSimResult };

export interface WorkerIn {
  game: import("@slot/engine").GameDefinition;
  spins: number;
  seed?: number | null;
}
