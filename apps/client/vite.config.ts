import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    port: 5173,
    headers: {
      'Content-Security-Policy': "default-src * 'unsafe-eval' 'unsafe-inline' data: blob:",
    },
  },
});
