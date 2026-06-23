import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest 設定借用 vite 設定（vitest/config 擴充了 vite 的 defineConfig）。
// base：本地開發/啟動工具用 "/"；GitHub Pages 部署時 workflow 會設 BASE_PATH=/slot-math-studio/。
// 透過 globalThis 取 process.env，避免在未載入 @types/node 的設定型別檢查下報 TS2591。
const BASE_PATH =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.BASE_PATH || "/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
