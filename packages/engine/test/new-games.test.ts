import { test, expect } from "vitest";
import { simulate, mulberry32, CASCADE_FG_GAME, STICKY_GAME, JACKPOT_GAME } from "../src/index";

/** 三個新範例遊戲的健全性（非黃金錨點，用合理帶）。 */
const SEED = 20260617;

test("cascade+FG demo is sane", () => {
  const r = simulate(CASCADE_FG_GAME, 500_000, mulberry32(SEED));
  expect(r.rtp).toBeGreaterThan(0.92);
  expect(r.rtp).toBeLessThan(0.98);
  expect(r.rtpFeat).toBeGreaterThan(0);          // 免費遊戲有貢獻
  expect(r.triggerOneIn).toBeGreaterThan(50);
  expect(r.triggerOneIn).toBeLessThan(400);
}, 60_000);

test("sticky wild demo is sane (bounded volatility)", () => {
  const r = simulate(STICKY_GAME, 500_000, mulberry32(SEED));
  expect(r.rtp).toBeGreaterThan(0.92);
  expect(r.rtp).toBeLessThan(0.98);
  expect(r.rtpFeat).toBeGreaterThan(0);
  expect(r.maxWin).toBeLessThan(5000);           // 不再失控（固定重抽、無歸位）
}, 60_000);

test("jackpot demo is sane (tiers pay, grand reachable)", () => {
  const r = simulate(JACKPOT_GAME, 1_000_000, mulberry32(SEED));
  expect(r.rtp).toBeGreaterThan(0.92);
  expect(r.rtp).toBeLessThan(0.98);
  expect(r.rtpFeat).toBeGreaterThan(0.1);        // 頭獎是主要貢獻
  expect(r.maxWin).toBeGreaterThanOrEqual(200);  // 至少打到 major
}, 60_000);
