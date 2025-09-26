#!/usr/bin/env node
/**
 * Bundler for Electron applications.
 * 
 * This script takes an Electron binary and app files, and bundles them
 * into a tar archive that can be extracted and run.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tar = require('tar');
const os = require('os');

/**
 * Extract the Electron binary from the zip file, preserving symlinks.
 */
function extractElectron(electronZipPath, extractDir) {
    console.log(`Extracting Electron from ${electronZipPath}`);
    
    // Use system unzip command to preserve symlinks
    // Node's built-in zip modules don't handle symlinks properly
    try {
        execSync(`unzip -q "${electronZipPath}" -d "${extractDir}"`, {
            stdio: 'pipe'
        });
    } catch (error) {
        throw new Error(`Failed to extract Electron: ${error.message}`);
    }
    
    console.log(`Extracted to ${extractDir}`);
}

/**
 * Find Electron.app in the extracted files
 */
function findElectronApp(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (item === 'Electron.app' && fs.statSync(fullPath).isDirectory()) {
            return fullPath;
        }
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findElectronApp(fullPath);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Copy directory recursively
 */
function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Create the app bundle with the provided files.
 */
function createAppBundle(tempDir, appName, mainJsPath, indexHtmlPath, assetPaths) {
    // Find the Electron.app in the extracted files
    const electronAppPath = findElectronApp(tempDir);
    
    if (!electronAppPath) {
        throw new Error("Could not find Electron.app in extracted files");
    }
    
    // Rename Electron.app to the app name
    const appBundlePath = path.join(tempDir, `${appName}.app`);
    fs.renameSync(electronAppPath, appBundlePath);
    
    // Create the app directory inside the bundle
    const appResourcesDir = path.join(appBundlePath, 'Contents', 'Resources', 'app');
    fs.mkdirSync(appResourcesDir, { recursive: true });
    
    // Copy main.js
    fs.copyFileSync(mainJsPath, path.join(appResourcesDir, 'main.js'));
    
    // Copy index.html
    fs.copyFileSync(indexHtmlPath, path.join(appResourcesDir, 'index.html'));
    
    // Copy additional assets
    for (const assetPath of assetPaths) {
        const stat = fs.statSync(assetPath);
        if (stat.isFile()) {
            fs.copyFileSync(assetPath, path.join(appResourcesDir, path.basename(assetPath)));
        } else if (stat.isDirectory()) {
            // Copy directory contents
            const destDir = path.join(appResourcesDir, path.basename(assetPath));
            copyDirSync(assetPath, destDir);
        }
    }
    
    // Create package.json
    const packageJson = {
        name: appName.toLowerCase().replace(/\s+/g, '-'),
        version: "1.0.0",
        main: "main.js"
    };
    fs.writeFileSync(
        path.join(appResourcesDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
    
    // Update Info.plist to use the app name
    const infoPlistPath = path.join(appBundlePath, 'Contents', 'Info.plist');
    if (fs.existsSync(infoPlistPath)) {
        let content = fs.readFileSync(infoPlistPath, 'utf8');
        // Replace Electron with app name in key places
        content = content.replace('<string>Electron</string>', `<string>${appName}</string>`);
        content = content.replace('<string>com.github.Electron</string>', `<string>com.gazel.${appName}</string>`);
        fs.writeFileSync(infoPlistPath, content);
    }
    
    return appBundlePath;
}

/**
 * Set execute permissions on a file
 */
function setExecutePermissions(filePath) {
    if (fs.existsSync(filePath)) {
        fs.chmodSync(filePath, 0o755);
        console.log(`Set execute permissions on ${filePath}`);
    }
}

/**
 * Create a tar archive of the app bundle.
 */
async function createTarArchive(appBundlePath, outputTarPath) {
    console.log(`Creating tar archive at ${outputTarPath}`);
    
    // First, fix permissions on the executable
    const executablePath = path.join(appBundlePath, 'Contents', 'MacOS', 'Electron');
    setExecutePermissions(executablePath);
    
    // Fix permissions on the main framework
    const frameworkPath = path.join(
        appBundlePath, 'Contents', 'Frameworks',
        'Electron Framework.framework', 'Versions', 'A',
        'Electron Framework'
    );
    setExecutePermissions(frameworkPath);
    
    // Also fix permissions on helper executables
    const helpersDir = path.join(
        appBundlePath, 'Contents', 'Frameworks',
        'Electron Framework.framework', 'Versions', 'A', 'Helpers'
    );
    if (fs.existsSync(helpersDir)) {
        const helpers = fs.readdirSync(helpersDir);
        for (const helper of helpers) {
            const helperPath = path.join(helpersDir, helper);
            const stat = fs.lstatSync(helperPath);
            if (stat.isFile() && !stat.isSymbolicLink()) {
                setExecutePermissions(helperPath);
            }
        }
    }
    
    // Fix permissions on libraries
    const libsDir = path.join(
        appBundlePath, 'Contents', 'Frameworks',
        'Electron Framework.framework', 'Versions', 'A', 'Libraries'
    );
    if (fs.existsSync(libsDir)) {
        const libs = fs.readdirSync(libsDir);
        for (const lib of libs) {
            if (lib.endsWith('.dylib')) {
                const libPath = path.join(libsDir, lib);
                const stat = fs.lstatSync(libPath);
                if (stat.isFile() && !stat.isSymbolicLink()) {
                    setExecutePermissions(libPath);
                }
            }
        }
    }
    
    // Create tar with proper symlink handling
    const appName = path.basename(appBundlePath);
    
    // Change to parent directory to create relative paths in tar
    const parentDir = path.dirname(appBundlePath);
    
    await tar.create(
        {
            file: outputTarPath,
            cwd: parentDir,
            preservePaths: false,
            portable: true,
            follow: false, // Don't follow symlinks, preserve them
        },
        [appName]
    );
    
    console.log(`Created tar archive: ${outputTarPath}`);
}

/**
 * Create a temporary directory
 */
function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'electron-bundler-'));
}

/**
 * Remove directory recursively
 */
function removeDirSync(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 5) {
        console.error("Usage: bundler.js <output_tar> <app_name> <main_js> <index_html> <electron_zip> [assets...]");
        process.exit(1);
    }
    
    const [outputTar, appName, mainJsPath, indexHtmlPath, electronZipPath, ...assetPaths] = args;
    
    console.log(`Building Electron app: ${appName}`);
    console.log(`Output: ${outputTar}`);
    console.log(`Main JS: ${mainJsPath}`);
    console.log(`Index HTML: ${indexHtmlPath}`);
    console.log(`Electron ZIP: ${electronZipPath}`);
    console.log(`Assets: ${assetPaths}`);
    
    // Create a temporary directory for extraction
    const tempDir = createTempDir();
    
    try {
        // Extract Electron
        extractElectron(electronZipPath, tempDir);
        
        // Create the app bundle
        const appBundlePath = createAppBundle(
            tempDir, appName, mainJsPath, indexHtmlPath, assetPaths
        );
        
        // Create the tar archive
        await createTarArchive(appBundlePath, outputTar);
        
        console.log(`Successfully created ${appName} bundle`);
    } finally {
        // Clean up temp directory
        removeDirSync(tempDir);
    }
}

// Run main function
main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
