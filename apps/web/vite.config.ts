import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // APIと共有する契約（TypeBox）。tsconfig.jsonのpathsと同じ対応。
    alias: { '@contracts': fileURLToPath(new URL('../api/src/contracts/index.ts', import.meta.url)) },
  },
  server: {
    host: process.env.WEB_HOST ?? '127.0.0.1',
    port: 5173,
    // 開発時は同一originに見せるため /api をAPIへ転送する。本番はAPIが静的ファイルを配信する。
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
