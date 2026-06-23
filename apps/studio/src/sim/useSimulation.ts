import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDefinition } from "@slot/engine";
import type { RichSimResult, WorkerOut } from "./types";

/**
 * 驅動 Web Worker 的 React hook。整個 app 共用一顆 worker。
 * run(game, spins, seed?)：seed 省略 = 設計用 Math.random；給 seed = 決定性。
 */
export function useSimulation() {
  const workerRef = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [res, setRes] = useState<RichSimResult | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const d = e.data;
      if (d.type === "progress") {
        setProgress(d.total ? d.done / d.total : 0);
      } else if (d.type === "done") {
        setRes(d.res);
        setProgress(1);
        setRunning(false);
      }
    };
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback((game: GameDefinition, spins: number, seed?: number | null) => {
    if (!workerRef.current) return;
    setRunning(true);
    setProgress(0);
    workerRef.current.postMessage({ game, spins, seed: seed ?? null });
  }, []);

  return { run, running, progress, res, setRes };
}

export type UseSimulation = ReturnType<typeof useSimulation>;
