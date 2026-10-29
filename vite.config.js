import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/webtoom/',
  plugins: [react()],
  build: { assetsInlineLimit: 0 },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'] }
});
