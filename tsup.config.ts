import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

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

export default defineConfig({
  // Named entry so the output lands at dist/cli/index.js, matching the bin field.
  entry: { 'cli/index': 'src/cli/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  // Inline .md files as string constants so no runtime file-read is needed.
  loader: { '.md': 'text' },
  external,
  clean: true,
  // Type declarations are not needed for a CLI binary.
  dts: false,
});
