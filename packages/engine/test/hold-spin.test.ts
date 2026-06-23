import { test, expect } from "vitest";
import { simulate, mulberry32, HOLD_SPIN_GAME } from "../src/index";

/**
 * Hold & Spin 範例遊戲的健全性（非黃金錨點 — 這是可調的 demo，故用「合理帶」而非定值）。
 * 守住：機制有觸發、有貢獻、RTP 在設計帶附近、波動偏高。日後調數值只要仍合理就會過。
 */
test("hold & spin demo is sane (triggers, contributes, RTP in band)", () => {
  const r = simulate(HOLD_SPIN_GAME, 500_000, mulberry32(20260617));

  // RTP 落在寬鬆設計帶（demo 可被微調，不綁死定值）
  expect(r.rtp).toBeGreaterThan(0.90);
  expect(r.rtp).toBeLessThan(0.99);

  // 是 feature 驅動的遊戲：機制要扛起相當比例的 RTP
  expect(r.perFeature.holdSpin).toBeGreaterThan(0);
  expect(r.rtpFeat / r.rtp).toBeGreaterThan(0.4);

  // 觸發率落在「稀有但會發生」的範圍
  expect(r.triggerOneIn).toBeGreaterThan(60);
  expect(r.triggerOneIn).toBeLessThan(300);

  // 高波動 + 有大獎尾端
  expect(r.sd).toBeGreaterThan(5);
  expect(r.maxWin).toBeGreaterThan(50);
}, 60_000);
