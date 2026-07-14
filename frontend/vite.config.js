import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': { target: 'http://localhost:8091', changeOrigin: true } } },
});
