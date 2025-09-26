# Gazel Electron Integration

## Overview

I've successfully converted Gazel into an Electron desktop application following the approach from the article "Building an Electron App with Bazel" by Graham Jenson. The implementation combines the article's Bazel-centric approach with modern TypeScript and npm tooling.

## What Was Implemented

### 1. Core Electron Files
- **`electron/main.ts`**: Main process that manages the app lifecycle, creates windows, and starts the Express server
- **`electron/preload.ts`**: Preload script for secure context bridging between main and renderer processes
- **`electron/electron.bzl`**: Custom Bazel rules inspired by the article's approach

### 2. Bazel Integration (Article-Inspired)
Following the article's pattern, I created:
- Custom `electron_app` rule for building Electron applications
- Custom `electron_package` rule for creating distributable packages
- Bundle script (`bundle.js`) as a Node.js equivalent of the article's Go bundler
- Run script template (`run.sh.tpl`) for launching the app across platforms

### 3. Build Configuration
- Updated `package.json` with Electron scripts and electron-builder configuration
- Created `electron/BUILD.bazel` with proper TypeScript compilation and app bundling
- Added necessary dependencies (electron, electron-builder)

### 4. Supporting Files
- **`assets/README.md`**: Instructions for creating app icons
- **`electron/README.md`**: Comprehensive documentation
- **`electron/launcher.sh`**: Convenience script for different run modes
- **`run-electron.sh`**: Simple script to compile and run the app
- **`test-electron.sh`**: Test script to verify the build

## Key Differences from the Article

While following the article's approach, I made several adaptations:

1. **TypeScript Support**: Used TypeScript instead of plain JavaScript
2. **NPM Integration**: Used npm-installed Electron rather than downloading binaries
3. **Full Stack**: Integrated both Express server and Svelte client
4. **Modern Tooling**: Added electron-builder for professional packaging

## How to Run

### Quick Start (Without Bazel)
```bash
# Simple run script
./run-electron.sh
```

### Using Bazel (Article's Approach)
```bash
# Development mode
bazel run //electron:dev

# Production mode  
bazel run //electron:run

# Create distributable packages
bazel run //electron:package
```

### Using Launcher Script
```bash
# Development
./electron/launcher.sh dev

# Production
./electron/launcher.sh prod

# Package for distribution
./electron/launcher.sh package
```

## Architecture

The Electron app follows this architecture:

```
┌─────────────────────────────────────┐
│         Electron Main Process        │
│            (main.ts)                 │
│  - Window Management                 │
│  - Server Process Management         │
│  - Native Menus & Dialogs           │
└──────────────┬──────────────────────┘
               │
               ├──────────────┐
               │              │
        ┌──────▼─────┐  ┌─────▼──────┐
        │   Express  │  │  Renderer  │
        │   Server   │  │  Process   │
        │  (Port 3002)│  │  (Svelte)  │
        └────────────┘  └────────────┘
```

## Features Implemented

✅ **Desktop Application**: Runs as a native desktop app on macOS, Windows, and Linux
✅ **Integrated Server**: Express server runs within the Electron app
✅ **Native Menus**: Application menu with standard desktop features
✅ **Workspace Selection**: Native file dialog for selecting Bazel workspaces
✅ **Secure Context**: Uses preload script for secure IPC communication
✅ **Bazel Build Rules**: Custom rules following the article's pattern
✅ **Cross-Platform Support**: Configured for all major desktop platforms

## Next Steps

To further enhance the Electron integration:

1. **Download Electron Binaries**: Like in the article, download platform-specific Electron binaries in WORKSPACE/MODULE.bazel
2. **Code Signing**: Add code signing for macOS and Windows
3. **Auto-Updates**: Implement auto-updater functionality
4. **Native Features**: Add more native integrations (system tray, notifications)
5. **Performance**: Optimize bundle size and startup time
6. **Testing**: Add Electron-specific tests

## Testing

Run the test script to verify everything is set up correctly:
```bash
./test-electron.sh
```

## Troubleshooting

If you encounter issues:

1. **Electron not found**: Run `pnpm add -D electron electron-builder`
2. **TypeScript errors**: Check that all TypeScript files compile with `npx tsc --noEmit`
3. **Bazel errors**: Ensure all dependencies are properly declared in BUILD files
4. **Server issues**: Verify the Express server runs independently

## Resources

- [Original Article](https://maori.geek.nz/building-an-electron-app-with-bazel-d124ed550957)
- [Repository Example](https://github.com/grahamjenson/bazel-electron)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Bazel Rules for JavaScript](https://github.com/aspect-build/rules_js)
