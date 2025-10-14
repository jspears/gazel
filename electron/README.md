# Gazel Electron App

This directory contains the Electron application for Gazel, a modern Bazel workspace explorer.

## Architecture

The Electron app is built using:
- **Electron 32.3.3** - Desktop application framework
- **Electron Forge** - Official packaging and distribution tool with Vite plugin
- **Vite 5.4.20** - Build tool and dev server for the renderer process
- **Svelte 5** - UI framework
- **Bazel** - Build system for managing dependencies and builds
- **iBazel** - Automatic rebuild on file changes

## Directory Structure

```
electron/
├── main.ts              # Electron main process entry point
├── preload.ts           # Preload script for IPC bridge
├── renderer.ts          # Renderer process entry point
├── index.html           # HTML entry point for renderer
├── forge.config.ts      # Electron Forge configuration
├── vite.main.config.ts  # Vite config for main process
├── vite.preload.config.ts # Vite config for preload script
├── vite.renderer.config.ts # Vite config for renderer process
├── dev-bazel.sh         # Development script with iBazel
└── BUILD.bazel          # Bazel build configuration
```

## Development

### Option 1: Development with iBazel (Recommended)

This mode uses iBazel to watch Bazel targets and automatically rebuild on file changes:

```bash
# From workspace root
pnpm run dev:bazel

# Or with Bazel
bazel run //electron:dev
```

**How it works:**
1. iBazel watches Bazel targets (`//client:client_src`, `//proto:index`, `//server:server_ts`, etc.)
2. When files change, iBazel automatically rebuilds affected targets
3. Vite detects changes in Bazel output directories and triggers hot reload
4. Electron Forge serves the app with updated code

### Option 2: Traditional Electron Forge

This mode runs Electron Forge without iBazel:

```bash
# From workspace root
pnpm start

# Or with Bazel
bazel run //electron:start
```

### Option 3: Debug Mode with Inspector

This mode starts Electron with the Node.js debugger enabled:

```bash
# With Bazel
bazel run //electron:debug
```

**How to debug:**
1. Run the debug target
2. Open Chrome and navigate to `chrome://inspect`
3. Click "Configure" and ensure `localhost:9229` is in the target discovery list
4. Click "inspect" under the Remote Target to open DevTools
5. Set breakpoints in your main process code (main.ts, server code, etc.)

**Note:** The `--inspect` flag only enables debugging for the main process. To debug the renderer process, use the built-in DevTools (which open automatically in dev mode).

## Building and Packaging

### Package the App

Creates a distributable package:

```bash
# With pnpm
pnpm package

# With Bazel
bazel build //electron:package
```

### Create Installers

Creates platform-specific installers (DMG for macOS, etc.):

```bash
# With pnpm
pnpm make

# With Bazel
bazel build //electron:make
```

## Configuration

### Electron Forge Configuration

The `forge.config.ts` file configures:
- **Packager options**: App name, executable name, icon, asar packaging
- **Vite plugin**: Builds main, preload, and renderer processes
- **Makers**: Platform-specific installer creators (DMG, Zip, etc.)

### Vite Configuration

Three separate Vite configs for different processes:

1. **vite.main.config.ts**: Main process (Node.js environment)
   - Builds `main.ts` to CommonJS
   - External dependencies (electron, node built-ins)

2. **vite.preload.config.ts**: Preload script (Node.js + browser context)
   - Builds `preload.ts` to CommonJS
   - External dependencies

3. **vite.renderer.config.ts**: Renderer process (browser environment)
   - Builds `renderer.ts` and serves `index.html`
   - Svelte plugin for component compilation
   - Path aliases for client code and proto files
   - Serves from `electron/` directory with `root: electronDir`

### Path Aliases

The renderer Vite config sets up these aliases:
- `$lib` → `client/lib`
- `$components` → `client/lib/components`
- `$stores` → `client/lib/stores`
- `$utils` → `client/lib/utils`
- `$types` → `client/lib/types`
- `proto` → `bazel-bin/proto` (or `proto/` as fallback)

**Important**: Always use `proto/gazel_pb` instead of `../proto/gazel_pb` for proto imports.

## Bazel Integration

### Targets

- `//electron:start` - Development mode with Electron Forge
- `//electron:dev` - Development mode with iBazel + Electron Forge
- `//electron:debug` - Development mode with Node.js debugger enabled (--inspect)
- `//electron:package` - Package the app
- `//electron:make` - Create installers

### How Bazel Works with Electron Forge

1. Bazel builds TypeScript sources and proto files to `bazel-bin/`
2. Electron Forge's Vite plugin uses the workspace root (via `BUILD_WORKSPACE_DIRECTORY`)
3. Vite resolves imports using path aliases that point to Bazel output directories
4. In development, Vite dev server serves from the `electron/` directory
5. iBazel watches source files and rebuilds when changes are detected

## Troubleshooting

### Proto Import Errors

If you see errors like `Failed to resolve import "../proto/gazel_pb"`:
- Use `proto/gazel_pb` instead of `../proto/gazel_pb`
- The `proto` alias is configured in `vite.renderer.config.ts`
- Make sure Bazel has built the proto files: `bazel build //proto:index`

### App Not Loading index.html

If the app shows a blank screen:
- Check that `root: electronDir` is set in `vite.renderer.config.ts`
- Verify `electron/index.html` exists
- Check the browser console for errors (DevTools opens automatically in dev mode)

### iBazel Not Detecting Changes

If iBazel doesn't rebuild on file changes:
- Make sure you're running `pnpm run dev:bazel` or `bazel run //electron:dev`
- Check that the file you're editing is part of a watched Bazel target
- Try restarting the dev server

### Build Errors

If you get Bazel build errors:
- Run `bazel clean` to clear the build cache
- Make sure all dependencies are installed: `pnpm install`
- Check that proto files are generated: `bazel build //proto:index`

## Environment Variables

The app uses these environment variables:

- `NODE_ENV` - Set to `development` or `production`
- `BUILD_WORKSPACE_DIRECTORY` - Set by Bazel to the workspace root
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` - Set by Electron Forge in dev mode
- `MAIN_WINDOW_VITE_NAME` - Set by Electron Forge to identify the renderer window

## Production Builds

For production builds, Electron Forge:
1. Builds all processes with Vite in production mode
2. Outputs to `.vite/` directory
3. Packages the app with electron-packager
4. Creates installers with platform-specific makers

The production build is self-contained and doesn't require Bazel or the source files.

