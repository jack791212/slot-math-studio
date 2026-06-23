# SLOT 數值設計工作站（slot-studio）

把 HANDOFF 原型轉成的正式 monorepo。核心理念與決策見 [`HANDOFF.md`](HANDOFF.md)，**請先讀它**。

一句話：把 `packages/engine` 當唯一真相沿用，用 §6 黃金測試守住數值，其餘（UI、模擬規模、規格書輸出、線上化）都是包在引擎外的加法。

工具分頁（3 個）：**試玩**（固定 16:9 `GameStage` + 強制進入機制看演出）/ **數值實驗室**（含進階分析/QA）/ **規格書**。

## 線上版（GitHub Pages）

推到 `main` 會自動建置並部署到 GitHub Pages（`.github/workflows/deploy.yml`）：
**https://jack791212.github.io/slot-math-studio/** — 不用開本地 server。

- 部署用 Vite 打包 `apps/studio`，base 設為 `/slot-math-studio/`（由 workflow 的 `BASE_PATH` 注入；本地開發仍是 `/`）。
- 每次 `git push` 到 `main` → Actions 跑測試（含黃金母版）+ build + 部署，約 1–2 分鐘更新。
- 本地仍可用 `啟動工具.cmd` 或 `pnpm dev`。

## 測試工具（拆成「看演出」與「看數據」兩處）

針對「很多狀況手動玩根本碰不到」而做，全部走引擎（`sim/analysis.ts` + `analysisWorker.ts`）。引擎靠 `FeatureResult.detail`（additive，不影響黃金值）回報機制內部狀態。

**在試玩頁 — 看演出（強制進入機制）**
- 依 game.features 自動列按鈕（「直接進『免費遊戲』」「直接進『Hold & Spin』」…）。
- 做出保證觸發的盤面 → 跑完整動畫（`runFG` / `runHoldSpin`），不用等隨機觸發。

**在數值實驗室 — 看數據（進階分析 / QA）**
- **機制結果分佈**：贏分百分位（p50/p90/p99/max）＋ 逐玩法明細（Hold&Spin 金幣數/填滿率、免費遊戲免費局數/retrigger）。
- **觸發間距 / 空轉分析**：最久要空轉幾局才進 bonus（玩家體感）。
- **大獎稀有度**：≥10x/50x/100x/250x 各是 1/N。
- **不變式檢查**：贏分≥0、無 NaN/∞、total=base+feature。
- **逐遊戲測試建議**：`recommendTests` 讀 game 定義，產出「這個遊戲該怎麼測」。

---

## 專案結構

```
slot-studio/
├─ packages/
│  └─ engine/                  # 純引擎，零 UI 依賴 = 唯一真相
│     ├─ src/index.ts          #   ← 由 HANDOFF 的 slot-engine.ts 搬入（僅加 3 個 export，見檔頭）
│     └─ test/golden.test.ts   #   §6 黃金基準回歸測試
├─ apps/
│  └─ studio/                  # 網頁工具（試玩 / 數值實驗室 / 規格書）
│     └─ src/
│        ├─ App.tsx            #   分頁外框
│        ├─ theme.ts           #   顏色 / 符號外觀（純表現層）
│        ├─ ui.tsx             #   共用小元件
│        ├─ sim/               #   模擬 harness：Web Worker + hook（重用引擎，不重寫數學）
│        │  ├─ harness.ts      #     simulateRich / runSession（loop 引擎的 spinOnce）
│        │  ├─ harness.test.ts #     漂移保護：simulateRich == engine.simulate
│        │  ├─ worker.ts       #     背景執行緒跑模擬
│        │  └─ useSimulation.ts#     驅動 worker 的 React hook
│        └─ tabs/              #   PlayPanel / LabPanel / SpecPanel
├─ HANDOFF.md                  # 交接藍圖（決策與數值的唯一來源）
├─ slot-engine.ts              # 原始交接快照（凍結，僅供對照；live 版在 packages/engine）
└─ slot-math-studio.jsx        # 原始原型快照（凍結，僅供對照；live 版在 apps/studio）
```

> 根目錄的 `slot-engine.ts` / `slot-math-studio.jsx` 是交接當下的快照，**不參與建置**，留作對照。
> 團隊熟悉後可刪除，避免與 `packages/` `apps/` 的 live 版混淆。

---

## 環境（已就緒）

這台機器是受管理的企業電腦（無系統管理員權限、防毒會擋 PowerShell 下載腳本），所以 Node 用**免安裝**方式裝在使用者資料夾：

- Node **v24.16.0**（LTS）有兩份：`%LOCALAPPDATA%\nodejs`（給終端機指令用）＋專案內 **`.node\`**（給 `啟動工具.cmd` 用，免裝、免 PATH）。
  `.node\` 放在 D 槽專案內是刻意的：這樣雙擊啟動檔一定找得到 Node（不依賴環境變數）。
- pnpm **9.15.0**（透過 Node 內建 corepack）。
- 相依套件已 `pnpm install` 完成，所有測試與 build 都已跑通。

> 若哪天要重裝 Node：到 https://nodejs.org 下載 **Windows Binary (.zip) x64**，解壓到 `%LOCALAPPDATA%\nodejs`，再把該資料夾加進「使用者環境變數 PATH」即可（免系統管理員）。

## 開啟工具（最簡單）

**直接雙擊根目錄的 [`啟動工具.cmd`](啟動工具.cmd)** → 會啟動伺服器並自動開瀏覽器（http://localhost:5173）。要關閉就關掉那個黑色視窗。

## 開發指令（在終端機）

在專案資料夾開 PowerShell，執行：

```powershell
pnpm dev                # 啟動 studio 開發伺服器（= 啟動工具.cmd 做的事）
pnpm test               # 跑所有測試（含黃金測試）
pnpm test:engine        # 只跑引擎黃金測試（接手「銜接完成」的判準）
pnpm build              # 型別檢查 + 打包 studio
```

### 「銜接完成」的判準（✅ 已通過）

```powershell
pnpm test:engine
```
綠燈代表 `packages/engine` 與 §6 黃金基準值（`DEFAULT_GAME` · `mulberry32(12345)` · 2,000,000 局 → RTP **94.958201%**）決定性相等，引擎完美銜接。

---

## 與原型的差異（重建時修正的點）

1. **消除重複引擎**：原型 `slot-math-studio.jsx` 內聯了一份引擎（寫死 `Math.random`、`5×3`、`"WILD"`）。
   studio 現在一律 `import` 自 `@slot/engine`，**不再各自重寫**（§3 原則一）。
2. **亂數注入**：試玩與設計用模擬傳 `Math.random`；黃金測試傳 `mulberry32`。引擎本身不自帶亂數。
3. **模擬移到 Web Worker**：~1M 局不卡 UI。
4. **harness 重用引擎分桶**：`simulateRich` 用引擎的 `spinOnce` / `bucketIndex` / `BUCKET_LABELS`，
   只在外層加收斂曲線與觸發次數等表現層彙總；`harness.test.ts` 斷言它與 `engine.simulate` 數值一致。
5. 引擎 `src/index.ts` 相對原始 `slot-engine.ts` 的**唯一改動**：把原本 private 的 `BET` /
   `BUCKET_LABELS` / `bucketIndex` 改成 `export`（無任何運算或符號順序變動）。

---

## 已內建的遊戲（右上角可切換）

1. **範例 · 烈焰 243** — 免費遊戲（freeSpins），RTP 94.96%（黃金錨點）。
2. **範例 · 黃金 Hold & Spin** — 金幣鎖定 / 收集（holdAndSpin），RTP≈94.9%、觸發 1/136、高波動。
3. **範例 · 連消寶石** — 連消（cascade），RTP 94.99%、中獎率≈50%、倍率階梯 1→2→3→5。
4. **範例 · 連消 + 免費遊戲** — cascade + freeSpinsCascade（兩條擴充軸疊加），RTP 94.7%；免費局內倍率全程累積、不重置。
5. **範例 · 黏性百搭** — sticky wild（固定重抽、wild 鎖定累積），RTP 95.5%。
6. **範例 · 漸進式頭獎** — jackpot（3+ JP 觸發、權重抽 mini/minor/major/grand），RTP≈95%。

### 引擎的兩條擴充軸

- **觸發式機制**（freeSpins / holdAndSpin…）：在 `FEATURE_HANDLERS` 註冊 `type`，簽名
  `(sampler, params, game, board, rng) => (count) => FeatureResult`；在 game 的 `features[]` 加一筆（必要時填 `triggerSymbol`/`triggerMin`）。`simulate` 自動分項統計、規格書自動多一張子規格。
- **結算模式**（cascade…，未來 cluster pays / ways↔lines）：不是觸發式，而是改 base 怎麼算。如 cascade = `game.cascade` + `cascadeBase()` + `spinOnce` 內分支。

兩種都：實驗室「機制參數」可加旋鈕、Play 分頁依型別加動畫（已示範 `runFG` / `runHoldSpin` / `runCascade`）、測試分析自動帶（hold&spin 金幣/填滿、cascade 連鎖鏈長）。

## 節奏 / 演出（試玩頁）

針對「AI 做 SLOT 常見的兩大缺陷：直接換圖太快、沒有真正滾輪感」重做：

- **真滾輪（向下）**：每欄 CSS reel-strip **向下**捲動（`index.css` 的 `reel-roll`，真實老虎機方向）→ 左到右**逐欄緩停**（`reel-settle` 回彈）。
- **三種轉輪模式**（試玩頁可切換，預設依遊戲）：`整欄滾輪`(strip) / `單格滾輪`(cell，每格自己一條輪帶，hold&spin 常見) / `掉落`(drop，符號由上落入 `reel-drop`)。
- **預報 anticipation**：`computeAnticipation(b)` 找「差一個就中 bonus」的欄 → 該欄起發金光、慢轉、多轉一段，營造緊張。
- **得獎反應時間**：盤面停定 → 看清停頓 → 才連消/進機制；連消每連、機制每步都有節奏停頓（`TIMING` 集中所有 ms）。
- **加速模式（turbo）**：試玩頁切換鈕，一個全域 speed factor（×0.32）縮放**所有**演出，方便快速測試；**只改演出、不改數值**。
- 架構：PlayPanel 用 `async/await` + `sleep(ms × speedRef)` + `runId` 版本號中止（取代 setTimeout 鏈），turbo 中途切換即時生效。

## 下一步（對應 HANDOFF §8 Roadmap）

- ③ **更多機制模組** — ✅ Hold & Spin 已完成（擴充流程已跑通）。可續加 sticky wild / cascade 連消 / 漸進式 JP。
- ① **AI 設計助手**：brief → AI 出 game 定義提案 → `simulate` 當裁判。
- ② **自動逼近**：給目標 RTP/波動，爬山法最佳化權重。
- ④ **規格書輸出升級**：PDF / Word（建議走後端）。
- 之後：`services/sim`（認證級大樣本）、`server`（存 / 分享 game 定義）。

生產化要拍板的旋鈕（WILD 賠付、抽樣模型、RNG 等級、模擬規模、win cap…）見 HANDOFF §9。
