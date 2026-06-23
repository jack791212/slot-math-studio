import { test, expect } from "vitest";
import { simulate, mulberry32, DEFAULT_GAME, HOLD_SPIN_GAME, type GameDefinition } from "@slot/engine";
import { simulateRich } from "./harness";

/**
 * 漂移保護：studio 的 simulateRich 必須與引擎的 simulate 在同一條種子下產生
 * 完全一致的核心指標。若有人哪天改了引擎的聚合公式而沒同步 harness，這條會紅燈。
 * 兩個遊戲都驗：免費遊戲（不吃 rng）與 Hold&Spin（吃 rng）都不能漂移。
 */
function expectNoDrift(game: GameDefinition, seed: number) {
  const SPINS = 50_000;
  const a = simulate(game, SPINS, mulberry32(seed));
  const b = simulateRich(game, SPINS, mulberry32(seed));

  expect(b.rtp).toBeCloseTo(a.rtp, 12);
  expect(b.rtpBase).toBeCloseTo(a.rtpBase, 12);
  expect(b.rtpFeat).toBeCloseTo(a.rtpFeat, 12);
  expect(b.hitRate).toBeCloseTo(a.hitRate, 12);
  expect(b.triggerOneIn).toBeCloseTo(a.triggerOneIn, 9);
  expect(b.sd).toBeCloseTo(a.sd, 9);
  expect(b.maxWin).toBeCloseTo(a.maxWin, 9);
  for (let i = 0; i < a.buckets.length; i++) {
    expect(b.buckets[i].pct).toBeCloseTo(a.buckets[i].pct, 9);
  }
}

test("simulateRich 與引擎 simulate 一致 · 免費遊戲", () => expectNoDrift(DEFAULT_GAME, 7));
test("simulateRich 與引擎 simulate 一致 · Hold & Spin", () => expectNoDrift(HOLD_SPIN_GAME, 7));
