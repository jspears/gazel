# Gazel Electron App

This directory contains the Electron desktop application wrapper for Gazel, inspired by the approach from [Building an Electron App with Bazel](https://maori.geek.nz/building-an-electron-app-with-bazel-d124ed550957).

## Architecture

The Electron integration follows the pattern described in the article:
- Custom Bazel rules for building Electron apps (`electron.bzl`)
- A bundler script that packages the app files with Electron
- Platform-specific run scripts for launching the app

## Key Components

### 1. **main.ts** - Electron Main Process
The main entry point for the Electron app that:
- Starts the Express server in the background
- Creates the browser window
- Handles app lifecycle events
- Provides native desktop features (menus, dialogs, etc.)

### 2. **preload.ts** - Preload Script
Securely exposes limited APIs to the renderer process:
- Workspace selection dialog
- Platform information
- Version details

### 3. **electron.bzl** - Custom Bazel Rules
Defines two main rules:
- `electron_app`: Builds and bundles the Electron application
- `electron_package`: Creates distributable packages using electron-builder

### 4. **bundle.js** - Bundler Script
A Node.js script (inspired by the Go bundler in the article) that:
- Creates the app directory structure
- Copies all necessary files
- Generates platform-specific metadata
- Creates a tar archive for distribution

## Building and Running

### Development Mode
```bash
# Using Bazel
bazel run //electron:dev

# Using npm scripts
npm run dev:electron
```

### Production Build
```bash
# Build the Electron app
bazel build //electron:gazel_app

# Run the production app
bazel run //electron:run

# Or use the launcher script
./electron/launcher.sh prod
```

### Creating Distributable Packages
```bash
# Create platform-specific packages
bazel run //electron:package

# Or use the launcher script
./electron/launcher.sh package
```

## Platform Support

The app supports:
- **macOS**: Creates a `.app` bundle
- **Windows**: Creates an NSIS installer
- **Linux**: Creates an AppImage

## Differences from the Article

While inspired by the article's approach, our implementation has some key differences:

1. **TypeScript Support**: We use TypeScript for the Electron main process
2. **NPM Integration**: We use npm-installed Electron rather than downloading binaries
3. **Full Stack App**: Includes both server (Express) and client (Svelte) components
4. **Modern Tooling**: Uses electron-builder for creating distributable packages

## File Structure

```
electron/
├── main.ts           # Electron main process
├── preload.ts        # Preload script for security
├── bundle.js         # Bundler script (Node.js version of the Go bundler)
├── run.sh.tpl        # Run script template
├── electron.bzl      # Custom Bazel rules
├── BUILD.bazel       # Bazel build configuration
├── launcher.sh       # Convenience launcher script
└── README.md         # This file
```

## Icon Requirements

Place application icons in the `assets/` directory:
- `icon.png` - Linux icon (512x512 or 1024x1024)
- `icon.icns` - macOS icon
- `icon.ico` - Windows icon

## Environment Variables

- `NODE_ENV`: Set to 'development' or 'production'
- `ELECTRON_APP`: Set to 'true' when running in Electron (used by server)
- `PORT`: Server port (default: 3002)

## Troubleshooting

### Electron not found
Make sure Electron is installed:
```bash
pnpm add -D electron
```

### Build fails
Ensure all dependencies are installed:
```bash
pnpm install
```

### App doesn't start
Check that the server can start independently:
```bash
bazel run //server:server_ts
```

## Future Improvements

- [ ] Add auto-updater functionality
- [ ] Implement code signing for distribution
- [ ] Add crash reporting
- [ ] Create installer configurations for all platforms
- [ ] Add native file system integration
- [ ] Implement custom protocol handlers
