import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        typescript: true
      })
    })
  ],
  
  resolve: {
    alias: {
      '$lib': path.resolve('./lib'),
      '$components': path.resolve('./lib/components'),
      '$stores': path.resolve('./lib/stores'),
      '$utils': path.resolve('./lib/utils'),
      '$types': path.resolve('./lib/types'),
      './client.ts': process.env.ELECTRON ? path.resolve('./client.ipc.ts') : path.resolve('./client.web.ts'),
    }
  },
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
