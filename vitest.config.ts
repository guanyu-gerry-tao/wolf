import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 只扫描 src/ 下的测试，排除编译产物 dist/
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
    exclude: ["dist/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
