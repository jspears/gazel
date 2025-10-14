# macOS Entitlements Configuration

## Overview

This document describes how custom entitlements are configured for the Gazel macOS application to enable full filesystem access and Bazel CLI execution.

## Problem

By default, `@electron/osx-sign` applies a set of default Electron entitlements that enable common features like JIT compilation, camera, microphone, etc. However, for Gazel to work properly, we need custom entitlements that:

1. **Disable the app sandbox** - Required for full filesystem access to Bazel workspaces
2. **Allow unsigned executable memory** - Required to execute Bazel CLI commands
3. **Disable library validation** - Required for Bazel and other CLI tools
4. **Enable file access** - Both read-only and read-write access to user-selected files
5. **Enable network access** - For the gRPC server

## Solution

### 1. Custom Entitlements File

Created `electron/entitlements.plist` with the following entitlements:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- JIT compilation for V8 -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    
    <!-- Allow reading from user-selected files -->
    <key>com.apple.security.files.user-selected.read-only</key>
    <true/>
    
    <!-- Allow writing to user-selected files -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    
    <!-- Allow executing other programs (for Bazel CLI execution) -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    
    <!-- Disable library validation (needed for Bazel and other CLI tools) -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    
    <!-- Disable sandbox for full filesystem access (required for Bazel workspace access) -->
    <key>com.apple.security.app-sandbox</key>
    <false/>
    
    <!-- Network access (for gRPC server) -->
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

### 2. Forge Configuration

Updated `electron/forge.config.ts` to use the `optionsForFile` callback, which is the correct way to apply custom entitlements according to the Electron Forge documentation:

```typescript
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
```

**Key Points:**
- The `optionsForFile` callback is called for each file being signed
- We return the same entitlements for all files
- `entitlements-inherit` ensures child processes inherit the same entitlements
- `hardenedRuntime: true` is required for notarization

### 3. Why `optionsForFile` is Required

Simply setting `entitlements` and `entitlements-inherit` at the top level of `osxSign` doesn't work because `@electron/osx-sign` has default entitlements that override them. The `optionsForFile` callback gives us full control over the entitlements for each file.

## Verification

After building with `yarn package`, verify the entitlements are applied:

```bash
codesign -d --entitlements - out/Gazel-darwin-arm64/Gazel.app
```

Expected output should show all custom entitlements:
```
[Key] com.apple.security.app-sandbox
[Value]
    [Bool] false
[Key] com.apple.security.cs.allow-jit
[Value]
    [Bool] true
[Key] com.apple.security.cs.allow-unsigned-executable-memory
[Value]
    [Bool] true
[Key] com.apple.security.cs.disable-library-validation
[Value]
    [Bool] true
[Key] com.apple.security.files.user-selected.read-only
[Value]
    [Bool] true
[Key] com.apple.security.files.user-selected.read-write
[Value]
    [Bool] true
[Key] com.apple.security.network.client
[Value]
    [Bool] true
[Key] com.apple.security.network.server
[Value]
    [Bool] true
```

Verify code signing and notarization:
```bash
# Check code signing
codesign -dv --verbose=4 out/Gazel-darwin-arm64/Gazel.app

# Check notarization
spctl -a -vv out/Gazel-darwin-arm64/Gazel.app
```

Expected output:
```
out/Gazel-darwin-arm64/Gazel.app: accepted
source=Notarized Developer ID
origin=Developer ID Application: Justin Spears (GEHR76GQX8)
```

## Security Implications

**Important:** Disabling the app sandbox (`com.apple.security.app-sandbox = false`) gives the app full access to the filesystem. This is necessary for Gazel to:
- Access any Bazel workspace on the user's machine
- Execute Bazel CLI commands
- Read and write build files

However, this means:
- The app is not sandboxed and has full system access
- Users should trust the app before running it
- The app cannot be distributed through the Mac App Store (which requires sandboxing)

## References

- [Electron Forge: Signing a macOS app](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [@electron/osx-sign documentation](https://github.com/electron/osx-sign)
- [Apple: Entitlements](https://developer.apple.com/documentation/bundleresources/entitlements)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened_runtime)

