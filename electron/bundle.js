#!/usr/bin/env node

/**
 * Electron App Bundler for Bazel
 * Inspired by the Go bundler from grahamjenson/bazel-electron
 * This script bundles the Electron app with all necessary files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tar = require('tar');

// Parse command line arguments
const [,, outputFile, appName, mainJS, preloadJS, indexHTML, ...additionalFiles] = process.argv;

if (!outputFile || !appName || !mainJS) {
  console.error('Usage: bundle.js <output.tar> <app-name> <main.js> <preload.js> <index.html> [additional files...]');
  process.exit(1);
}

// Create a temporary directory for staging
const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'electron-bundle-'));
const appDir = path.join(tempDir, `${appName}.app`);
const contentsDir = path.join(appDir, 'Contents');
const resourcesDir = path.join(contentsDir, 'Resources');
const appResourcesDir = path.join(resourcesDir, 'app');

// Create directory structure
fs.mkdirSync(appResourcesDir, { recursive: true });

// Copy Electron binaries (if we had downloaded them like in the article)
// For now, we'll use the npm-installed Electron
// In production, you might want to download and bundle the Electron binary

// Create package.json
const packageJson = {
  name: appName.toLowerCase().replace(/\s+/g, '-'),
  version: '1.0.0',
  main: 'main.js',
  description: `${appName} - Built with Bazel and Electron`
};

fs.writeFileSync(
  path.join(appResourcesDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Copy main.js
if (fs.existsSync(mainJS)) {
  fs.copyFileSync(mainJS, path.join(appResourcesDir, 'main.js'));
} else {
  console.error(`Main JS file not found: ${mainJS}`);
  process.exit(1);
}

// Copy preload.js if provided
if (preloadJS && fs.existsSync(preloadJS)) {
  fs.copyFileSync(preloadJS, path.join(appResourcesDir, 'preload.js'));
}

// Copy index.html if provided
if (indexHTML && fs.existsSync(indexHTML)) {
  fs.copyFileSync(indexHTML, path.join(appResourcesDir, 'index.html'));
}

// Copy additional files (server, client builds, etc.)
additionalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    const basename = path.basename(file);
    const destPath = path.join(appResourcesDir, basename);
    
    if (stat.isDirectory()) {
      copyDirectoryRecursive(file, destPath);
    } else {
      fs.copyFileSync(file, destPath);
    }
  }
});

// Create Info.plist for macOS
const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${appName}</string>
  <key>CFBundleExecutable</key>
  <string>Electron</string>
  <key>CFBundleIdentifier</key>
  <string>com.gazel.app</string>
  <key>CFBundleName</key>
  <string>${appName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>`;

fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist);

// Create the tar archive
console.log(`Creating tar archive: ${outputFile}`);
tar.create(
  {
    file: outputFile,
    cwd: tempDir,
    portable: true,
    gzip: false
  },
  [`${appName}.app`]
).then(() => {
  console.log(`Successfully created ${outputFile}`);
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
}).catch(err => {
  console.error('Error creating tar archive:', err);
  process.exit(1);
});

// Helper function to copy directory recursively
function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}
