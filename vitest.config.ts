import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// Inline .md and .toml files as raw strings so tests can import them the
// same way the production build does (tsup `loader: { '.md': 'text', '.toml': 'text' }`).
const fileRaw: Plugin = {
  name: "file-raw",
  enforce: "pre",
  transform(src, id) {
    if (id.endsWith(".md") || id.endsWith(".toml")) {
      return { code: `export default ${JSON.stringify(src)}`, map: null };
    }
  },
};

export default defineConfig({
  plugins: [fileRaw],
  test: {
    // 只扫描 src/ 下的测试，排除编译产物 dist/
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
    exclude: ["dist/**", "node_modules/**"],
    passWithNoTests: true,
    // Stub WOLF_ANTHROPIC_API_KEY + playwright.chromium so guards don't
    // fail mid-test. See vitest.setup.ts for details.
    setupFiles: ["./vitest.setup.ts"],
  },
});
