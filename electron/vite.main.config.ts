import { defineConfig } from 'vite';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import viteTSConfigPaths from 'vite-tsconfig-paths';

const __filename = fileURLToPath(import.meta.url);
const electronDir = path.dirname(__filename);
const workspaceRoot = path.dirname(electronDir);

const protoGeneratedDir = path.resolve(workspaceRoot, 'bazel-bin/proto');
const protoSourceDir = path.resolve(workspaceRoot, 'proto');
const protoAlias = existsSync(protoGeneratedDir) ? protoGeneratedDir : protoSourceDir;

console.log('[vite.main.config] Proto alias:', protoAlias);

// https://vitejs.dev/config
export default defineConfig({
  plugins: [viteTSConfigPaths()],
  resolve: {
    alias: {
      proto: protoAlias,
      '@speajus/gazel-proto': protoAlias,
      // Resolve Bazel proto imports for build_pb.js
      '../build_pb.js': path.resolve(workspaceRoot, 'bazel-bin/proto/_virtual_imports/build_proto/build_pb.js'),
      '../stardoc_output_pb.js': path.resolve(workspaceRoot, 'bazel-bin/proto/_virtual_imports/build_proto/stardoc_output_pb.js'),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [
        'electron',
        'fs',
        'path',
        'url',
        'os',
        'child_process',
      ],
      output: {
        format: 'cjs',
        entryFileNames: 'main.cjs',
      },
      plugins: [
        nodeResolve({
          preferBuiltins: true,
          extensions: ['.js', '.ts', '.cjs', '.mjs', '.json'],
        }),
        commonjs(),
      ],
    },
  },
});

