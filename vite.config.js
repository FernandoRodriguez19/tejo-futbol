import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Phaser alone is ~1.5 MB, so the default 500 kB warning is just noise.
    chunkSizeWarningLimit: 2500,
  },
});
