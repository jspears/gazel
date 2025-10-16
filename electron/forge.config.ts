import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { notarize } from '@electron/notarize';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import dotenv from 'dotenv';

// Load environment variables from .env file for code signing
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const electronDir = path.dirname(__filename);
const entitlementsPath = path.join(electronDir, 'entitlements.plist');

// Debug: Log notarization configuration
const hasNotarizationEnv = !!(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);
console.log('[forge.config] Notarization will be:', hasNotarizationEnv ? 'ENABLED' : 'DISABLED');
console.log('[forge.config] Entitlements path:', entitlementsPath);
console.log('[forge.config] Entitlements exists:', fs.existsSync(entitlementsPath));
if (hasNotarizationEnv) {
  console.log('[forge.config] API Key ID:', process.env.APPLE_API_KEY_ID);
  console.log('[forge.config] API Issuer:', process.env.APPLE_API_ISSUER);
  console.log('[forge.config] API Key file:', process.env.APPLE_API_KEY);
}


const config: ForgeConfig = {
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'jspears',
          name: 'gazel'
        },
        prerelease: true
      }
    }
  ],
  packagerConfig: {
    name: 'Gazel',
    executableName: 'gazel',
    icon: './assets/icon',
    // Enable asar for production builds
    // The renderer packaging issue has been fixed with the packageAfterCopy hook
    asar: true,
    // macOS code signing configuration
    // Enable code signing for macOS builds with custom entitlements
    osxSign: {
      optionsForFile: () => {
        // Return custom entitlements for all files
        return {
          entitlements: entitlementsPath,
          'entitlements-inherit': entitlementsPath,
          hardenedRuntime: true,
        };
      },
    },
    // macOS notarization configuration using App Store Connect API key
    // Requires environment variables to be set (see .env.example)
    // Note: Notarization requires the app to be signed first
    osxNotarize: hasNotarizationEnv ? {
      tool: 'notarytool',
      appleApiKey: process.env.APPLE_API_KEY!,
      appleApiKeyId: process.env.APPLE_API_KEY_ID!,
      appleApiIssuer: process.env.APPLE_API_ISSUER!,
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
    postPackage: async (_config, options) => {
      console.log('[forge.config] postPackage hook - checking if notarization is needed');

      // Only notarize on macOS
      if (options.platform !== 'darwin') {
        console.log('[forge.config] Skipping notarization - not macOS');
        return;
      }

      // Only notarize if credentials are available
      if (!hasNotarizationEnv) {
        console.log('[forge.config] Skipping notarization - credentials not found');
        return;
      }

      // outputPaths[0] is the directory containing the .app bundle
      // We need to find the .app bundle inside it
      const outputDir = options.outputPaths[0];
      const appName = `${_config.packagerConfig.name}.app`;
      const appPath = path.join(outputDir, appName);

      console.log(`[forge.config] Notarizing ${appPath}...`);
      console.log('[forge.config] This may take 2-10 minutes...');

      try {
        await notarize({
          tool: 'notarytool',
          appPath,
          appleApiKey: process.env.APPLE_API_KEY!,
          appleApiKeyId: process.env.APPLE_API_KEY_ID!,
          appleApiIssuer: process.env.APPLE_API_ISSUER!,
        });
        console.log('[forge.config] ✓ Notarization successful!');
      } catch (error) {
        console.error('[forge.config] ✗ Notarization failed:', error);
        throw error;
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

