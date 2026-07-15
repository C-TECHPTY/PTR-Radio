import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8091';

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: backendUrl, changeOrigin: true } },
  },
});
