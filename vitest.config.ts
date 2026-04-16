import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// Inline .md files as raw strings so tests can import them the same way
// the production build does (tsup loader: { '.md': 'text' }).
const mdRaw: Plugin = {
  name: "md-raw",
  enforce: "pre",
  transform(src, id) {
    if (id.endsWith(".md")) {
      return { code: `export default ${JSON.stringify(src)}`, map: null };
    }
  },
};

export default defineConfig({
  plugins: [mdRaw],
  test: {
    // 只扫描 src/ 下的测试，排除编译产物 dist/
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
    exclude: ["dist/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
