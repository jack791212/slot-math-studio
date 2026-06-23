import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest 設定借用 vite 設定（vitest/config 擴充了 vite 的 defineConfig）。
// base：本地開發/啟動工具用 "/"；GitHub Pages 部署時 workflow 會設 BASE_PATH=/slot-math-studio/。
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
