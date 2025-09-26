# Gazel Electron App with Electron Forge + Vite

## Overview

Your Gazel application has been successfully converted into an Electron desktop app using Electron Forge with the Vite plugin, following the modern approach recommended in the Electron Forge documentation.

## Key Features

### 1. **Electron Forge Integration**
- Uses `@electron-forge/cli` for building and packaging
- Configured with `@electron-forge/plugin-vite` for modern bundling
- Supports multiple platform builds (Windows, macOS, Linux)

### 2. **Vite Configuration**
- **Main Process** (`vite.main.config.mjs`): Bundles the Electron main process
- **Preload Script** (`vite.preload.config.mjs`): Bundles the preload script
- **Renderer Process** (`vite.renderer.config.mjs`): Bundles the Svelte frontend

### 3. **Build System**
- Leverages Vite's fast build times and HMR support
- Automatic code splitting and optimization
- TypeScript support out of the box

## How to Run

### Development Mode
```bash
# Start the Electron app with hot reload
pnpm electron
# or
npx electron-forge start
```

### Build for Production
```bash
# Package the app (creates unpacked app)
pnpm electron:package

# Create distributable installers
pnpm electron:make

# Publish to configured destinations
pnpm electron:publish
```

## Project Structure

```
gazel/
├── electron/
│   ├── main.ts          # Main process with Vite dev server support
│   └── preload.ts       # Preload script for secure IPC
├── client/              # Svelte frontend
├── server/              # Express backend
├── forge.config.js      # Electron Forge configuration
├── vite.main.config.mjs    # Vite config for main process
├── vite.preload.config.mjs # Vite config for preload
├── vite.renderer.config.mjs # Vite config for renderer
└── .npmrc               # pnpm configuration with hoisting
```

## Key Implementation Details

### 1. **Vite Plugin Variables**
The app uses Electron Forge's Vite plugin variables for conditional loading:
```typescript
if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  // Development: Load from Vite dev server
  mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
} else {
  // Production: Load built files
  mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}
```

### 2. **pnpm Configuration**
Required `.npmrc` settings for Electron Forge:
```
node-linker=hoisted
shamefully-hoist=true
```

### 3. **Native Modules**
External dependencies are properly configured in Vite to avoid bundling issues:
```javascript
rollupOptions: {
  external: ['electron', 'path', 'fs', 'os', 'child_process', 'express', ...]
}
```

## Advantages Over Previous Approach

1. **Modern Tooling**: Uses Vite instead of manual TypeScript compilation
2. **Hot Module Replacement**: Full HMR support in development
3. **Optimized Builds**: Vite's build optimization for production
4. **Cross-Platform**: Built-in support for creating platform-specific installers
5. **Developer Experience**: Better error messages and faster rebuilds
6. **Official Support**: Following Electron Forge's recommended patterns

## Available Makers

The app is configured with multiple makers for different platforms:
- **Squirrel.Windows**: Creates Windows installers
- **ZIP**: Creates macOS ZIP archives
- **deb**: Creates Debian/Ubuntu packages
- **rpm**: Creates Red Hat/Fedora packages

## Next Steps

1. **Custom Icons**: Add platform-specific icons in the `assets/` directory
2. **Code Signing**: Configure code signing for distribution
3. **Auto-Update**: Implement auto-update functionality
4. **CI/CD**: Set up automated builds with GitHub Actions

## Troubleshooting

If you encounter issues:
1. Ensure Electron is properly installed: `cd node_modules/electron && node install.js`
2. Clear and reinstall dependencies: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
3. Check that `.npmrc` has the correct hoisting configuration

The app is now ready for development and distribution as a native desktop application!
