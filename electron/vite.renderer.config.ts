import { defineConfig, type Plugin } from 'vite';
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

console.log('[vite.renderer.config] electronDir:', electronDir);
console.log('[vite.renderer.config] index.html path:', path.resolve(electronDir, 'index.html'));
console.log('[vite.renderer.config] index.html exists:', existsSync(path.resolve(electronDir, 'index.html')));
console.log('[vite.renderer.config] Proto alias:', protoAlias);

// Plugin to resolve Bazel proto imports
function bazelProtoResolverPlugin(): Plugin {
  return {
    name: 'bazel-proto-resolver',
    resolveId(source, importer) {
      // Handle relative imports of build_pb.js and stardoc_output_pb.js
      if (source === '../build_pb.js' || source === '../stardoc_output_pb.js') {
        const fileName = source.replace('../', '');
        const resolved = path.resolve(workspaceRoot, 'bazel-bin/proto/_virtual_imports/build_proto', fileName);
        console.log(`[bazel-proto-resolver] Resolving ${source} from ${importer} to ${resolved}`);
        return resolved;
      }
      return null;
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  base: './',
  root: path.resolve(electronDir),
  publicDir: path.resolve(clientRoot, 'public'),
  resolve: {
    alias: {
      '@speajus/gazel-proto': protoAlias,
      // Resolve Bazel proto imports for build_pb.js
      '../build_pb.js': path.resolve(workspaceRoot, 'bazel-bin/proto/_virtual_imports/build_proto/build_pb.js'),
      '../stardoc_output_pb.js': path.resolve(workspaceRoot, 'bazel-bin/proto/_virtual_imports/build_proto/stardoc_output_pb.js'),
    },
  },
  server: {
    // Explicitly set the entry point for dev server
    fs: {
      strict: true,
      allow: [
        // Allow serving from electron directory
        electronDir,
        // Allow serving from client directory (for imports)
        clientRoot,
        // Allow serving from workspace root (for node_modules, etc.)
        workspaceRoot,
      ],
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(electronDir, 'index.html'),
      external: ['electron'],
    },
  },
  define:{
      'process.env.VITE_ELECTRON': '1'
  },

  css: {
    postcss: path.resolve(clientRoot, 'postcss.config.js'),
  },

  plugins: [
    bazelProtoResolverPlugin(),
    viteTSConfigPaths(),
    svelte({

    }),
  ],
  optimizeDeps: {
    exclude: ['electron'],
  },
});

