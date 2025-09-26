# Gazel Electron App

This directory contains the Electron desktop application configuration for Gazel, fully integrated with Bazel for consistent build management.

## Structure

```
electron-app/
├── BUILD.bazel            # Bazel build configuration
├── package.json           # Electron-specific dependencies
├── forge.config.js        # Electron Forge configuration
├── vite.main.config.mjs  # Vite config for main process
├── vite.preload.config.mjs # Vite config for preload script
└── vite.renderer.config.mjs # Vite config for renderer
```

## Running the Electron App with Bazel

### Development Mode:
```bash
# Start with hot reload and debugging
bazel run //electron-app:dev

# Standard start
bazel run //electron-app:start

# Convenience alias
bazel run //electron-app:run
```

### Production Builds:
```bash
# Package the application
bazel run //electron-app:package

# Create platform installers
bazel run //electron-app:make
```

## How It Works

1. **Electron Forge** manages the build and packaging process
2. **Vite Plugin** bundles the TypeScript code for:
   - Main process (`../electron/main.ts`)
   - Preload script (`../electron/preload.ts`)
   - Renderer process (`../client/`)
3. **Separate package.json** keeps Electron dependencies isolated
4. **Relative paths** reference the main codebase without interfering with Bazel

## Building for Distribution

```bash
# Create unpacked app
npm run package

# Create platform-specific installers
npm run make
```

## Configuration

The app is configured to build for multiple platforms:
- **Windows**: Squirrel installer
- **macOS**: ZIP archive
- **Linux**: DEB and RPM packages

## Development

The Electron app uses the same source files as the web version:
- Frontend: `../client/` (Svelte)
- Backend: `../server/` (Express)
- Electron-specific: `../electron/` (Main & Preload)

This separation ensures that:
1. Bazel builds continue to work normally
2. Electron configuration doesn't interfere with web builds
3. Dependencies are properly isolated
4. Both build systems can coexist
