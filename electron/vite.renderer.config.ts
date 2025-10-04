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


const protoGeneratedDir = path.resolve(workspaceRoot, 'bazel-bin/proto');
const protoSourceDir = path.resolve(workspaceRoot, 'proto');
const protoAlias = existsSync(protoGeneratedDir) ? protoGeneratedDir : protoSourceDir;

// https://vitejs.dev/config
export default defineConfig({
  base: './',
  root: electronDir,
  publicDir: path.resolve(clientRoot, 'public'),
  build: {
    rollupOptions: {
      input: path.resolve(electronDir, 'index.html'),
    },
  },
  define:{
      'process.env.VITE_ELECTRON': '1'
  },
  resolve: {
    alias: {
      $lib: path.resolve(clientRoot, 'lib'),
      $components: path.resolve(clientRoot, 'components'),
      $stores: path.resolve(clientRoot, 'lib/stores'),
      $utils: path.resolve(clientRoot, 'lib/utils'),
      $types: path.resolve(clientRoot, 'lib/types'),
      proto: protoAlias,
    },
  },
  css: {
    postcss: path.resolve(clientRoot, 'postcss.config.js'),
  },

  plugins: [
    viteTSConfigPaths(),
//    patchSvelteLoad(),
    svelte({
      // preprocess: sveltePreprocess({
      //   typescript: true,
      // }),
    }),
  ],
});

