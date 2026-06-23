import { test, expect } from "vitest";
import { simulate, mulberry32, DEFAULT_GAME, GOLDEN } from "../src/index";

/**
 * §6 黃金基準值（回歸契約）。這是接手「完美銜接」的錨點：
 * 引擎被移植 / 重構後，這條測試確保數值沒跑掉。RTP 是決定性相等（8 位小數）。
 * 其餘指標依 HANDOFF 記載的小數位數做相對寬鬆的比對（避免常數四捨五入造成假紅燈）。
 */
test(
  "engine matches golden master (DEFAULT_GAME · mulberry32(12345) · 2,000,000 局)",
  () => {
    const r = simulate(DEFAULT_GAME, GOLDEN.spins, mulberry32(GOLDEN.seed));

    // 高精度錨點：決定性相等
    expect(r.rtp).toBeCloseTo(GOLDEN.rtp, 8);
    expect(r.rtpBase).toBeCloseTo(GOLDEN.rtpBase, 8);
    expect(r.rtpFeat).toBeCloseTo(GOLDEN.rtpFeat, 8);
    expect(r.hitRate).toBeCloseTo(GOLDEN.hitRate, 8);
    expect(r.perFeature.freeGames).toBeCloseTo(GOLDEN.perFeature.freeGames, 8);

    // HANDOFF 記載到較少小數位的指標：用對應精度比對
    expect(r.sd).toBeCloseTo(GOLDEN.sd, 5);
    expect(r.maxWin).toBeCloseTo(GOLDEN.maxWin, 2);
    expect(r.triggerOneIn).toBeCloseTo(GOLDEN.triggerOneIn, 2);
  },
  120_000,
);
