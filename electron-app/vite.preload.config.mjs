import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, '../electron/preload.ts'),
      formats: ['cjs'],
      fileName: () => '[name].js'
    },
    rollupOptions: {
      external: ['electron']
    },
    outDir: path.resolve(__dirname, '.vite/build'),
    emptyOutDir: false
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../')
    }
  }
});
