import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VIEW web (Vite). In dev il proxy inoltra /api e /ws al CONTROLLER (FastAPI:8000),
// evitando problemi CORS e mantenendo separati View e Controller (§2.3.2).
// In Docker il backend è raggiungibile come http://backend:8000 (variabile API_TARGET).
const API_TARGET = process.env.API_TARGET || 'http://localhost:8000';
const WS_TARGET = API_TARGET.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/ws': { target: WS_TARGET, ws: true },
    },
  },
});
