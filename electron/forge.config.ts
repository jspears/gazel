import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const electronDir = path.dirname(__filename);


const config: ForgeConfig = {
  packagerConfig: {
    name: 'Gazel',
    executableName: 'gazel',
    icon: './assets/icon',
    // Temporarily disable asar to debug renderer loading issue
    // The Electron Forge Vite plugin has known issues with asar packaging
    // See: https://github.com/electron/forge/issues/3423
    asar: false,
    // macOS code signing configuration
    // Enable code signing for macOS builds
    osxSign: {},
    // macOS notarization configuration using App Store Connect API key
    // Requires environment variables to be set (see .env.example)
    osxNotarize: process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER ? {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    } : undefined,
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Workaround for Electron Forge Vite plugin not copying renderer files
      // See: https://github.com/electron/forge/issues/3423
      const rendererSource = path.resolve(electronDir, '.vite/renderer');
      const rendererDest = path.join(buildPath, '.vite/renderer');

      if (fs.existsSync(rendererSource)) {
        console.log(`Copying renderer files from ${rendererSource} to ${rendererDest}`);
        await fs.copy(rendererSource, rendererDest);
        console.log('✓ Renderer files copied successfully');
      } else {
        console.warn(`⚠ Renderer source directory not found: ${rendererSource}`);
      }
    },
  },
  makers: [
    new MakerSquirrel({
      name: 'Gazel',
      setupIcon: './assets/icon.ico',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({
      options: {
        icon: './assets/icon.png',
      },
    }),
    new MakerDeb({
      options: {
        icon: './assets/icon.png',
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: path.resolve(electronDir, 'main.ts'),
          config: path.resolve(electronDir, 'vite.main.config.ts'),
          target: 'main',
        },
        {
          entry: path.resolve(electronDir, 'preload.ts'),
          config: path.resolve(electronDir, 'vite.preload.config.ts'),
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: path.resolve(electronDir, 'vite.renderer.config.ts'),
          // Explicitly specify the HTML entry point
          // This ensures the renderer files are properly packaged
        },
      ],
    }),
  ],
};

export default config;

