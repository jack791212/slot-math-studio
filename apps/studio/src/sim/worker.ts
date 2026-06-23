/// Web Worker：在背景執行緒跑設計用模擬，不卡 UI。
/// 訊息進：{ game, spins, seed? }；訊息出：{type:"progress"} / {type:"done", res}。
import { mulberry32 } from "@slot/engine";
import { simulateRich } from "./harness";
import type { WorkerIn, WorkerOut } from "./types";

// 避免 DOM 與 WebWorker lib 的 self 型別衝突：用最小介面描述 worker 全域。
const ctx = self as unknown as {
  postMessage: (m: WorkerOut) => void;
  onmessage: ((e: MessageEvent<WorkerIn>) => void) | null;
};

ctx.onmessage = (e) => {
  const { game, spins, seed } = e.data;
  // seed 有給 → 決定性（mulberry32）；沒給 → 設計用快速亂數（Math.random）。
  const rng = seed != null ? mulberry32(seed) : Math.random;
  const res = simulateRich(game, spins, rng, (done, total) => {
    ctx.postMessage({ type: "progress", done, total });
  });
  ctx.postMessage({ type: "done", res });
};
