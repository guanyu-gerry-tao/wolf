import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'esbuild';

// Keep all declared dependencies external so tsup doesn't bundle node_modules.
// This is required for native addons (better-sqlite3, playwright) and avoids
// duplicating large packages like @anthropic-ai/sdk in the output bundle.
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
];
const buildMode = process.env.WOLF_BUILD_MODE === 'dev' ? 'dev' : 'stable';

// Strip <!-- HTML comments --> from .md files at bundle time.
// These document things for wolf maintainers (e.g. "Consumed by: ...") and
// must never reach end-user workspaces or AI prompts. The runtime `//` line
// stripper in src/utils/stripComments.ts handles the user-facing markers
// separately — those must be preserved here.
const stripHtmlCommentsPlugin: Plugin = {
  name: 'strip-html-comments-md',
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, async (args) => {
      const { readFile } = await import('node:fs/promises');
      const raw = await readFile(args.path, 'utf-8');
      const stripped = raw.replace(/<!--[\s\S]*?-->/g, '');
      // Return as 'text' so esbuild inlines it as a string constant,
      // matching the existing `loader: { '.md': 'text' }` behavior.
      return { contents: stripped, loader: 'text' };
    });
  },
};

export default defineConfig({
  // Named entry so the output lands at dist/cli/index.js, matching the bin field.
  entry: { 'cli/index': 'src/cli/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  // Inline .md files as string constants so no runtime file-read is needed.
  loader: { '.md': 'text' },
  define: {
    __WOLF_BUILD_MODE__: JSON.stringify(buildMode),
  },
  external,
  clean: true,
  // Type declarations are not needed for a CLI binary.
  dts: false,
  esbuildPlugins: [stripHtmlCommentsPlugin],
  // Copy static assets that are loaded at runtime via file:// URLs.
  // tsup bundles all chunks to dist/ root, so __dirname resolves to dist/,
  // meaning shell.html must live at dist/render/shell.html.
  onSuccess: 'mkdir -p dist/render && cp src/service/impl/render/shell.html dist/render/shell.html',
});
