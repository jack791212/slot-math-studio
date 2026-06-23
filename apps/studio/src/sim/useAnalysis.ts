import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDefinition } from "@slot/engine";
import type { Analysis } from "./analysis";

type Out = { type: "progress"; done: number; total: number } | { type: "done"; res: Analysis };

/** 驅動分析 Worker 的 hook（測試分頁專用，獨立一顆 worker）。 */
export function useAnalysis() {
  const workerRef = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [res, setRes] = useState<Analysis | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("./analysisWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<Out>) => {
      const d = e.data;
      if (d.type === "progress") setProgress(d.total ? d.done / d.total : 0);
      else if (d.type === "done") { setRes(d.res); setProgress(1); setRunning(false); }
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []);

  const run = useCallback((game: GameDefinition, spins: number, seed?: number | null) => {
    if (!workerRef.current) return;
    setRunning(true); setProgress(0);
    workerRef.current.postMessage({ game, spins, seed: seed ?? null });
  }, []);

  return { run, running, progress, res };
}
