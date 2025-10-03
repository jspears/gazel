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

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      proto: protoAlias,
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
        viteTSConfigPaths(),
        nodeResolve({
          preferBuiltins: true,
          extensions: ['.js', '.ts', '.cjs', '.mjs', '.json'],
        }),
        commonjs(),
      ],
    },
  },
});

