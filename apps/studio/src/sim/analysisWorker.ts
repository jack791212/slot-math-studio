/// Web Worker：背景跑 analyzeGame（測試/分析），不卡 UI。
import { mulberry32, type GameDefinition } from "@slot/engine";
import { analyzeGame, type Analysis } from "./analysis";

type Out = { type: "progress"; done: number; total: number } | { type: "done"; res: Analysis };
const ctx = self as unknown as {
  postMessage: (m: Out) => void;
  onmessage: ((e: MessageEvent<{ game: GameDefinition; spins: number; seed?: number | null }>) => void) | null;
};

ctx.onmessage = (e) => {
  const { game, spins, seed } = e.data;
  const rng = seed != null ? mulberry32(seed) : Math.random;
  const res = analyzeGame(game, spins, rng, (done, total) => ctx.postMessage({ type: "progress", done, total }));
  ctx.postMessage({ type: "done", res });
};
