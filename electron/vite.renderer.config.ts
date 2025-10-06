import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import viteTSConfigPaths from 'vite-tsconfig-paths';

const __filename = fileURLToPath(import.meta.url);
const electronDir = path.dirname(__filename);
const workspaceRoot = path.dirname(electronDir);
const clientRoot = path.resolve(workspaceRoot, 'client');

console.log('[vite.renderer.config] electronDir:', electronDir);
console.log('[vite.renderer.config] index.html path:', path.resolve(electronDir, 'index.html'));
console.log('[vite.renderer.config] index.html exists:', existsSync(path.resolve(electronDir, 'index.html')));

// https://vitejs.dev/config
export default defineConfig({
  base: './',
  root: path.resolve(electronDir),
  publicDir: path.resolve(clientRoot, 'public'),
  server: {
    // Explicitly set the entry point for dev server
    fs: {
      strict: false,
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(electronDir, 'index.html'),
    },
  },
  define:{
      'process.env.VITE_ELECTRON': '1'
  },
  
  css: {
    postcss: path.resolve(clientRoot, 'postcss.config.js'),
  },

  plugins: [
    viteTSConfigPaths(),
    svelte({
   
    }),
  ],
});

