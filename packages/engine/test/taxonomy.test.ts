import { describe, it, expect } from "vitest";
import { GAMES, TAXONOMY, AXES, taxonomyEntry, byAxis, type Axis } from "../src";

describe("taxonomy 分類目錄", () => {
  it("三軸齊全、key 不重複", () => {
    expect(AXES.map((a) => a.id).sort()).toEqual(["mechanic", "mode", "pay"]);
    const keys = TAXONOMY.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length); // 無重複 key
    for (const axis of ["pay", "mode", "mechanic"] as Axis[]) expect(byAxis(axis).length).toBeGreaterThan(0);
  });

  it("每個條目欄位完整、axis 與所屬軸一致", () => {
    for (const e of TAXONOMY) {
      expect(e.key && e.nameEN && e.nameZH).toBeTruthy();
      expect(e.definition && e.mathLevers && e.volatility && e.howToTest).toBeTruthy();
      expect(["core", "common", "niche"]).toContain(e.prevalence);
      expect(["pay", "mode", "mechanic"]).toContain(e.axis);
    }
  });

  it("user 點名的關鍵詞都有對應條目", () => {
    for (const key of [
      "lines", "ways", "megaways", "cluster", "scatterPays", // 贏分方式
      "holdAndSpin", "pickGame", // 玩法模式
      "expandingWild", "walkingWild", "symbolCollection", "symbolRemoval", // 遊戲機制
    ]) expect(taxonomyEntry(key), `缺少 taxonomy key: ${key}`).toBeDefined();
  });
});

describe("遊戲分類標記與目錄一致", () => {
  it("每個遊戲的 payMechanic 對應 pay 軸條目", () => {
    for (const g of GAMES) {
      const key = g.payMechanic ?? "ways";
      const e = taxonomyEntry(key);
      expect(e, `${g.id} payMechanic=${key} 無對應條目`).toBeDefined();
      expect(e!.axis).toBe("pay");
    }
  });

  it("每個 feature 都標了 category，且 taxonomyKey 對應正確軸", () => {
    for (const g of GAMES) {
      for (const f of g.features) {
        expect(["mode", "mechanic"], `${g.id}/${f.id} 未標 category`).toContain(f.category);
        if (f.taxonomyKey) {
          const e = taxonomyEntry(f.taxonomyKey);
          expect(e, `${g.id}/${f.id} taxonomyKey=${f.taxonomyKey} 無對應條目`).toBeDefined();
          expect(e!.axis).toBe(f.category); // mode→mode 軸、mechanic→mechanic 軸
        }
      }
    }
  });

  it("game.mechanics 內的 key 皆為 mechanic 軸條目", () => {
    for (const g of GAMES) {
      for (const k of g.mechanics ?? []) {
        const e = taxonomyEntry(k);
        expect(e, `${g.id} mechanics 含未知 key: ${k}`).toBeDefined();
        expect(e!.axis).toBe("mechanic");
      }
    }
  });
});
