import { defineConfig } from 'vite';
import viteTSConfigPaths from 'vite-tsconfig-paths';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  publicDir: 'public',
  plugins: [
    viteTSConfigPaths(),
    svelte({
       compilerOptions: {
        // Enable dev mode features
        dev: true,
      },
      inspector:true,
    })
  ],
  resolve: {
    alias: {
      '../build_pb.js': '../proto/_virtual_imports/build_proto/build_pb.js',
      '../stardoc_output_pb.js': '../proto/_virtual_imports/build_proto/stardoc_output_pb.js',
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
