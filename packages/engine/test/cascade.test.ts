import { test, expect } from "vitest";
import { simulate, mulberry32, buildSampler, spinOnce, CASCADE_GAME } from "../src/index";

/**
 * Cascade 範例遊戲健全性（非黃金錨點，用合理帶）。
 * 守住：RTP 在帶內、中獎頻繁、連消真的會連鎖（出現多步連消）。
 */
test("cascade demo is sane (RTP in band, chains happen)", () => {
  const r = simulate(CASCADE_GAME, 500_000, mulberry32(20260617));
  expect(r.rtp).toBeGreaterThan(0.90);
  expect(r.rtp).toBeLessThan(0.99);
  expect(r.hitRate).toBeGreaterThan(0.35); // 連消遊戲中獎頻繁

  // 連消確實連鎖：跑一段，要出現 ≥3 步的連消、且多步連消夠常見
  const rng = mulberry32(3);
  const sampler = buildSampler(CASCADE_GAME, rng);
  let maxSteps = 0, multi = 0;
  for (let i = 0; i < 30000; i++) {
    const sr = spinOnce(sampler, CASCADE_GAME, rng);
    if (sr.cascadeSteps > maxSteps) maxSteps = sr.cascadeSteps;
    if (sr.cascadeSteps >= 2) multi++;
  }
  expect(maxSteps).toBeGreaterThanOrEqual(3);
  expect(multi).toBeGreaterThan(200);
}, 60_000);
