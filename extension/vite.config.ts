import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

// Vite + crxjs builds the MV3 extension into dist/. The manifest stays the
// source of truth: we import it as JSON and pass it to the crx plugin so the
// plugin can wire HTML, service worker, and side panel entry points.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // MV3 extensions only run on Chrome 88+; target a recent Chrome so
    // top-level await and other modern syntax compile cleanly. The companion
    // also runs as a static-served web app for harness testing — modern
    // browsers support all of this.
    target: 'chrome120',
  },
  // Companion talks to wolf serve at http://127.0.0.1:<port>; nothing else.
  server: {
    port: 5173,
    strictPort: false,
  },
});
