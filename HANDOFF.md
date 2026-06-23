# SLOT 數值設計工作站 — 交接文件（Handoff）

把目前的原型轉成正式、可上線、可長期迭代的專案。目標是「**完美銜接**」：接手的人（或 Claude Code）拿到這份文件＋兩個檔，就能在不重新推導任何決策與數值的前提下繼續。

**配套檔案**
- `slot-engine.ts` — 已驗證的純引擎（無框架依賴）。**這是整個案子的核心資產。**
- `slot-math-studio.jsx` — 原型 UI（試玩 / 數值實驗室 / 規格書），當作正式 UI 的參考實作，不是要直接拿去上線的程式。

---

## 1. 這個案子在做什麼

博弈（SLOT）設計以「**數值**」為核心：RTP、波動性、中獎率、機制的數值如何分配與分佈，決定玩家的體感與黏著度。優先序是「數值（含機制玩法）≥ 節奏 > 美術 = 音效」，而且節奏其實是數值的輸出、美術音效是把數值翻譯成體感的皮。

工具的存在意義：讓企劃用「模擬出來的數據」設計與驗證遊戲，**不准用「我感覺 / 我預期」**定案。同時把規格書做進工具，數值自動帶入，不另開文件。

針對方向：**真錢線上 / 實體機台、SLOT、體感優先**（合規是另一套獨立檢核，這裡只留標記鉤子）。

---

## 2. 原型目前到哪

`slot-math-studio.jsx`（React 單檔）已有三個分頁：

- **試玩**：可實際 spin、亮中獎、進免費遊戲；大獎分級 banner 由「贏分門檻」觸發（演示「表現服務數值」）。
- **數值實驗室**：改權重 / 賠付 → 重新模擬 → 即時出 RTP（含 95% 信賴區間）、中獎率、feature 佔比、觸發率、波動、倍數分佈圖、RTP 收斂曲線、玩家旅程曲線。
- **規格書**：核心描述可編輯；數值總表 / 子規格 / 觸發率自動從模擬帶入；自動打勾的驗證 checklist；複製 Markdown / 匯出遊戲定義 JSON。

引擎已用 Node 驗證（5M / 10M 局），並產生**固定種子可重現的黃金基準值**（見 §6）。

---

## 3. 架構原則（銜接的關鍵，務必先讀）

讓 code 完美銜接、之後又能無痛擴充的根本，是這個分層：

```
            ┌──────────────────────────────────────────────┐
            │            game 定義（JSON / 物件）            │   ← 唯一資料來源，可序列化
            │  盤面 · 符號 · 權重 · 賠付 · 散佈 · features[]  │      （= 共用 / 版控 / 團隊互傳的格式）
            └──────────────────────────────────────────────┘
                                  │ 餵入
                                  ▼
            ┌──────────────────────────────────────────────┐
            │      純引擎  slot-engine.ts （無框架依賴）       │   ← 唯一真相，可移植到任何環境/語言
            │   buildSampler / spinOnce / simulate / …       │      亂數由外部注入（見下）
            │   FEATURE_HANDLERS（機制模組登錄表）           │
            └──────────────────────────────────────────────┘
                  │                  │                  │
                  ▼                  ▼                  ▼
         ┌────────────┐     ┌──────────────┐    ┌────────────────┐
         │  試玩 UI    │     │  模擬 harness │    │  規格書產生器   │
         │ (React/Web) │     │ (Worker/Node) │    │  (數值自動帶入)  │
         └────────────┘     └──────────────┘    └────────────────┘
```

四個原則：

1. **純引擎是唯一真相。** 試玩、設計用模擬、上線認證模擬，全部共用 `slot-engine.ts` 的同一份邏輯，**不要各自重寫**，否則三邊數值會漂移。
2. **game 定義是唯一資料來源，且可序列化。** 換遊戲 = 換一份定義；它就是未來線上共用、版本控管、企劃互傳的格式（JSON）。
3. **亂數「注入」。** 引擎不自帶亂數，由外部傳 `rng`：設計用傳 `Math.random`；測試 / 認證傳可種子化 PRNG（`mulberry32`）或密碼學等級 RNG。這讓引擎可決定性測試，也讓認證能換成合格 RNG。
4. **同一份引擎餵兩種模擬。** 瀏覽器內的「設計用模擬」（~1M 局、即時調參）與「上線認證模擬」（數千萬～數十億局）是同一套邏輯的不同規模執行。

---

## 4. 引擎契約（`slot-engine.ts` 對外介面）

| 函式 | 用途 |
|---|---|
| `mulberry32(seed): Rng` | 可種子化 PRNG，測試與認證決定性一致 |
| `buildSampler(game, rng): Sampler` | 依權重建立抽樣器（rng 注入） |
| `drawBoard(sampler, game): Board` | 抽一個盤面（每格獨立加權抽樣） |
| `evalWays(b, game): number` | 243 ways 評分（快速版，模擬用） |
| `evalDetailed(b, game)` | 評分 + 中獎格子座標（試玩 UI 高亮用） |
| `spinOnce(sampler, game): SpinResult` | 單局：主遊戲 + 觸發機制，回傳 base / feature / 分機制貢獻 |
| `simulate(game, spins, rng): SimResult` | 參考模擬，回傳全部指標（RTP、分項、波動、倍數分佈…） |
| `FEATURE_HANDLERS` | 機制模組登錄表（加機制在此註冊） |
| `DEFAULT_GAME` | 範例遊戲定義 |
| `GOLDEN` | 黃金基準值（回歸契約） |

**決定性保證**：同一份 `game` + 同一條 `rng` 序列 → 完全相同的結果。**符號順序（`game.symbols`）是契約的一部分**，移植時不可更動順序，否則 PRNG 抽樣序列改變、黃金值對不上。

---

## 5. 資料 schema（game 定義）

型別在 `slot-engine.ts` 的 `GameDefinition`。重點欄位：

- `layout`：`{reels, rows, model}` — 盤面與賠付模型（目前 `243 ways`）。
- `symbols` / `paying` / `wild` / `scatter.symbol`：符號集合、參與賠付的符號（依優先序）、百搭、散佈。
- `weights`：每個符號的權重點數（機率 = 權重 / 總和）。**這是調 RTP / 波動的主要旋鈕之一。**
- `paytable`：符號 → `[3連, 4連, 5連]` 賠付（× 總押注）。另一個主要旋鈕。
- `scatter.pays`：散佈數 → 賠付。
- `features[]`：每個機制一筆 `{id, type, label, trigger, desc, params}`。
- 規格書用的敘述欄位：`name / tagline / expectation / audience / volatilityTarget / rtpTarget / rtpTolerance`。

**新增一個機制（例：sticky wild / hold & spin 重抽 / cascade 連消 / 漸進式 JP）：**
1. 在 `FEATURE_HANDLERS` 註冊一個 `type`：簽名 `(sampler, params, game) => (count) => 該機制贏分`。
2. 在某個 game 的 `features[]` 加一筆，填它的 `params`。
3. `simulate` 會自動分項統計這個機制的 RTP 貢獻；規格書頁也會自動多出一張它的子規格。

---

## 6. 黃金基準值（回歸契約）★ 銜接的錨點

引擎只要被移植或重構，就用這條測試確保數值沒跑掉。**這是決定性相等，不是「接近」。**

```
game = DEFAULT_GAME
prng = mulberry32(12345)
spins = 2,000,000

RTP            = 94.958201%   ← 移植後必須完全相等
RTP_base       = 55.743229%
RTP_feature    = 39.214972%   (feature 佔 41.297%)
hitRate        = 47.655750%
triggerOneIn   = 129.4415
SD             = 6.846332
maxWin         = 1195.805x
perFeature.freeGames = 39.214972%
```

測試範例（Vitest / Jest）：

```ts
import { simulate, mulberry32, DEFAULT_GAME, GOLDEN } from "./slot-engine";

test("engine matches golden master", () => {
  const r = simulate(DEFAULT_GAME, GOLDEN.spins, mulberry32(GOLDEN.seed));
  expect(r.rtp).toBeCloseTo(GOLDEN.rtp, 8); // 8 位小數
});
```

**先寫這條測試（紅燈）→ 放進 `slot-engine.ts`（綠燈）**，就完成了引擎這一段的「完美銜接」。

大樣本 sanity（換成 `Math.random`、跑 ≥10M）：RTP 應落在約 **94.3%–95.0%** 之間（高波動 → 需要很大樣本才收斂；這也是為什麼最終 RTP 定案要回到 RD 的大規模執行）。

---

## 7. 建議專案結構與技術選型

以下是建議，RD 可依團隊習慣調整。重點是維持 §3 的分層。

```
slot-studio/
├─ packages/
│  └─ engine/            # = slot-engine.ts，純 TypeScript，零 UI 依賴
│     ├─ src/index.ts
│     └─ test/golden.test.ts   # §6 黃金測試
├─ apps/
│  └─ studio/            # 網頁工具（試玩 / 實驗室 / 規格書）
│     └─ src/...         # 參考 slot-math-studio.jsx 重寫
├─ services/             # (可選) 認證級模擬
│  └─ sim/               # Node Worker 跑大樣本；之後可換 Rust/Go 跑數十億局
└─ server/               # (可選) 存 / 分享 game 定義（線上多人版的後端）
```

選型建議：

- **語言**：TypeScript（型別 = 契約 = 防漂移）。引擎已是 TS。
- **前端**：React + Vite（或 Next.js，若要 SSR / 後端整合）；圖表延用 Recharts。
- **設計用模擬放 Web Worker**：~1M 局別卡 UI。引擎是純函式，丟進 Worker 很乾淨。
- **認證 / 大樣本模擬**：先用 Node 跑同一份 TS 引擎；要更快再移植到 Rust/Go/C++，並用 §6 黃金值驗證移植正確。
- **線上多人**（你要的「推給所有企劃用」）：把 game 定義存後端（一個 JSON 一筆紀錄），加版本 / 分享 / 權限。資料格式現在就對了，所以這步是純加法。

---

## 8. Roadmap 對應到架構

之前討論的下一步，各自落在哪一層：

| 項目 | 落點 | 說明 |
|---|---|---|
| 1. AI 設計助手（反向第一層） | apps/studio | 接 API：輸入 brief → AI 回一份 game 定義的修改提案 → 丟進引擎 `simulate` 驗證。AI 出初稿、模擬當裁判、人做決定。 |
| 2. 自動逼近（反向第二層） | packages/engine + Worker | 給目標 RTP/波動，最佳化迴圈（爬山法）反覆呼叫引擎調權重逼近目標。 |
| 3. 更多機制模組 | packages/engine | 在 `FEATURE_HANDLERS` 加 type（sticky wild / hold & spin / cascade / JP…）。建議先做這個把擴充流程跑通一次。 |
| 4. 規格書輸出升級 | apps/studio / server | Markdown 已有；PDF / Word 匯出建議走後端產生。 |

---

## 9. 生產化要拍板的事（原型的簡化）

這些在原型裡是刻意簡化的旋鈕，正式版要做決定：

- **WILD 賠付**：目前 WILD 只替代、不另計自身賠付。要不要給 WILD 賠付？（會改變 RTP 與 ways 計分規則。）
- **抽樣模型**：目前每格獨立加權抽樣。要不要改成模擬輪帶帶位（影響符號相鄰、near-miss 的可控性、堆疊符號等）。
- **RNG 等級**：設計用 `Math.random` 即可；上線 / 認證要換成合格 RNG。引擎已支援注入。
- **模擬規模**：瀏覽器 ~1M 是設計用；最終 RTP 定案要 RD 跑數千萬～數十億局並送第三方認證。**原型不是認證工具。**
- **最大贏分封頂（win cap）**、**面額 / 押注模型（denominations / bet ways）**、**ways ↔ paylines 的一般化**（若未來有非 243-ways 的遊戲）。
- **合規 / 數值心理學**（near-miss、LDW…）：獨立檢核系統。規格書只留標記鉤子，不在這裡設計。

---

## 10. 用 Claude Code 接手的具體步驟

1. 開 repo，把 `HANDOFF.md`、`slot-engine.ts`、`slot-math-studio.jsx` 放進去。
2. 請 Claude Code 照 §7 scaffold monorepo（packages/engine、apps/studio）。
3. **先寫 §6 的黃金測試**，把 `slot-engine.ts` 放進 `packages/engine` → 跑測試應綠燈。這條過了 = 引擎銜接完成。
4. 參考 `slot-math-studio.jsx` 在 `apps/studio` 重建 UI，模擬改跑 Web Worker。
5. 再依 §8 做 roadmap（建議 3 → 1）。

接手時可以這樣開場（貼給 Claude Code）：

> 讀 HANDOFF.md 與 slot-engine.ts。先建 §7 的 monorepo 結構，把 engine 放進 packages/engine，並寫一條黃金測試（§6）assert `simulate(DEFAULT_GAME, 2_000_000, mulberry32(12345)).rtp` 等於 0.94958201。測試綠燈後再開始重建 apps/studio。

---

**一句話總結銜接的關鍵**：把 `slot-engine.ts` 當唯一真相沿用，用 §6 黃金測試守住數值，其餘（UI、模擬規模、規格書輸出、線上化）都是包在引擎外的加法。
