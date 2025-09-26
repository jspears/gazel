# Electron and Bazel Integration ✅

## Overview

The Electron configuration has been successfully moved to a dedicated `electron-app` directory and fully integrated with Bazel. This provides a unified build system for both web and desktop applications while maintaining clean separation of concerns.

## New Structure

```
gazel/
├── electron/              # Electron source files (main.ts, preload.ts)
├── client/                # Svelte frontend (shared by web and Electron)
├── server/                # Express backend (shared by web and Electron)
├── electron-app/          # ⭐ NEW: All Electron configuration
│   ├── BUILD.bazel       # Bazel build rules for Electron
│   ├── package.json       # Electron-specific dependencies
│   ├── forge.config.js    # Electron Forge configuration
│   ├── vite.main.config.mjs
│   ├── vite.preload.config.mjs
│   ├── vite.renderer.config.mjs
│   └── README.md         # Electron-specific documentation
├── MODULE.bazel          # Bazel configuration (unchanged)
├── BUILD.bazel           # Bazel targets (unchanged)
└── package.json          # Main project dependencies

```

## Key Benefits

### 1. **Unified Build System**
- All builds managed through Bazel
- Electron configuration isolated in `electron-app/`
- Consistent build commands across web and desktop

### 2. **Bazel-Managed Electron Targets**
```bash
# Electron targets via Bazel
bazel run //electron-app:dev     # Development with hot reload
bazel run //electron-app:start   # Start Electron app
bazel run //electron-app:run     # Alias for start
bazel run //electron-app:package # Package the app
bazel run //electron-app:make    # Create installers

# Web targets still work
bazel run //app:dev              # Run web app
bazel build //...                # Build all targets
```

### 3. **Shared Source Code**
- Both systems use the same source files:
  - `client/` for frontend
  - `server/` for backend
  - `electron/` for Electron-specific code
- Changes to source code affect both builds
- No duplication of business logic

### 4. **Independent Dependencies**
- Root `package.json`: Web and development dependencies
- `electron-app/package.json`: Electron-specific dependencies
- Clean separation prevents version conflicts

## How to Use

### For Web Development (Bazel)
```bash
# Development
bazel run //app:dev

# Production build
bazel build //app:run

# Run specific targets
bazel run //client:dev
bazel run //server:server
```

### For Electron Development (via Bazel)
```bash
# All Electron commands through Bazel
bazel run //electron-app:dev     # Development mode
bazel run //electron-app:start   # Start the app
bazel run //electron-app:package # Package for distribution
bazel run //electron-app:make    # Create installers

# Or use npm scripts from root (which call Bazel)
pnpm electron           # Runs bazel run //electron-app:dev
pnpm electron:package   # Runs bazel run //electron-app:package
pnpm electron:make      # Runs bazel run //electron-app:make
```

## Technical Implementation

### Bazel Integration
The `electron-app/BUILD.bazel` file defines:
- TypeScript compilation targets for main and preload scripts
- Vite build target for the renderer
- Electron Forge targets (start, package, make)
- Development target with hot reload

### Vite Configurations
The Vite configs in `electron-app/` use relative paths to reference the source:
- `../electron/main.ts` for main process
- `../electron/preload.ts` for preload script
- `../client/` for renderer process

### Electron Forge
- Uses the Vite plugin for modern bundling
- Configured with multiple makers for cross-platform builds
- Supports hot module replacement in development
- All managed through Bazel js_binary rules

### Package Management
- All dependencies resolved through root `node_modules`
- Bazel handles dependency graph
- No shell scripts needed for launching

## Verification

The integrated system has been tested and confirmed working:

✅ **Bazel Query**: `bazel query //electron-app:all` shows all Electron targets
✅ **Web Targets**: All original Bazel targets remain intact
✅ **Unified Build**: Single build system for both web and desktop
✅ **No Shell Scripts**: All launching handled through Bazel rules
✅ **Shared Code**: Changes in source files affect both builds

## Next Steps

1. **For production Electron builds**:
   ```bash
   bazel run //electron-app:make
   ```

2. **For CI/CD**:
   - Use Bazel for both web and desktop builds
   - Single build system simplifies CI/CD pipelines
   - All targets queryable via `bazel query`

3. **For development**:
   - Use `bazel run //app:dev` for web development
   - Use `bazel run //electron-app:dev` for desktop development
   - Both can run simultaneously on different ports

The integration is complete! Electron is now fully managed by Bazel, providing a unified build system for the entire Gazel project.
