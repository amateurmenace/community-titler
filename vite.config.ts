import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built site works from any path (GitHub Pages subpath included)
export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
