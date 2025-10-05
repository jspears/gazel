import { defineConfig } from 'vite';
import viteTSConfigPaths from 'vite-tsconfig-paths';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    viteTSConfigPaths(),
    svelte({

    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/gazel.GazelService': {
        target: `http://localhost:${process.env.PORT || 3002}`,
        changeOrigin: true
      },
      '/api': {
        target: `http://localhost:${process.env.PORT || 3002}`,
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
  }
});
