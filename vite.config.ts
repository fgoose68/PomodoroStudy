import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react', '@duckdb/duckdb-wasm'],
  },
  resolve: {
    alias: {
      '@duckdb/duckdb-wasm': '@duckdb/duckdb-wasm/dist/duckdb-browser.mjs',
    },
  },
});
