# macOS Notarization Issue and Solution

## Problem

The packaged Gazel app shows as "Unnotarized" when running:
```bash
spctl -a -vv out/Gazel-darwin-arm64/Gazel.app
# Output: rejected - source=Unnotarized Developer ID
```

The app IS signed correctly with your Developer ID certificate, but it's NOT notarized by Apple.

## Root Cause

**Electron Forge's `osxNotarize` configuration does NOT automatically trigger notarization.**

After extensive investigation, I discovered that:

1. **`electron-packager`** (used by Electron Forge) passes `osxNotarize` to `@electron/osx-sign`
2. **`@electron/osx-sign`** only handles CODE SIGNING, not notarization
3. **Notarization must be done separately** using `@electron/notarize` or manual `xcrun notarytool` commands

The `osxNotarize` configuration in `forge.config.ts` is essentially ignored by the current Electron Forge workflow.

## Solution: Manual Notarization with postPackage Hook

Since Electron Forge doesn't automatically notarize, we need to add a `postPackage` hook that calls `@electron/notarize` manually.

### Step 1: Install @electron/notarize

```bash
yarn add -D @electron/notarize
```

### Step 2: Add postPackage Hook

Update `electron/forge.config.ts` to add notarization in the `postPackage` hook:

```typescript
import { notarize } from '@electron/notarize';

// ... existing code ...

hooks: {
  packageAfterCopy: async (_config, buildPath) => {
    // ... existing renderer copy code ...
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

    const appPath = options.outputPaths[0];
    console.log(`[forge.config] Notarizing ${appPath}...`);

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
```

### Step 3: Alternative - Manual Notarization Script

If you prefer not to modify the Forge config, you can manually notarize after packaging:

```bash
# 1. Package the app
yarn package

# 2. Create a ZIP for notarization
ditto -c -k --keepParent out/Gazel-darwin-arm64/Gazel.app Gazel.zip

# 3. Submit for notarization
xcrun notarytool submit Gazel.zip \
  --key /Users/justinspears/Downloads/AuthKey_X8AQXQ8VJR.p8 \
  --key-id X8AQXQ8VJR \
  --issuer 69a6de7f-91fb-47e3-e053-5b8c7c11a4d1 \
  --wait

# 4. Staple the notarization ticket
xcrun stapler staple out/Gazel-darwin-arm64/Gazel.app

# 5. Create the final ZIP
cd out/make/zip/darwin/arm64
zip -r Gazel-darwin-arm64-1.0.0.zip ../../Gazel-darwin-arm64/Gazel.app
```

## Verification

After notarization completes, verify:

```bash
# Check code signing
codesign -dv --verbose=4 out/Gazel-darwin-arm64/Gazel.app

# Check notarization status
spctl -a -vv out/Gazel-darwin-arm64/Gazel.app
# Should show: accepted - source=Notarized Developer ID

# Check stapled ticket
stapler validate out/Gazel-darwin-arm64/Gazel.app
```

## What Changed

I've already made these changes to `electron/forge.config.ts`:

1. **Added dotenv loading** (line 10-12):
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();
   ```

2. **Added debug logging** (lines 18-25):
   ```typescript
   const hasNotarizationEnv = !!(process.env.APPLE_API_KEY && ...);
   console.log('[forge.config] Notarization will be:', hasNotarizationEnv ? 'ENABLED' : 'DISABLED');
   ```

3. **Added `tool: 'notarytool'`** (line 44):
   ```typescript
   osxNotarize: hasNotarizationEnv ? {
     tool: 'notarytool',  // ← Required for modern notarization
     appleApiKey: process.env.APPLE_API_KEY!,
     appleApiKeyId: process.env.APPLE_API_KEY_ID!,
     appleApiIssuer: process.env.APPLE_API_ISSUER!,
   } : undefined,
   ```

## Next Steps

**To fix the notarization issue:**

1. Change `asar: false` to `asar: true` in `electron/forge.config.ts` (line 36)
2. Run `rm -rf out/ && yarn make`
3. Wait for notarization (watch for "Notarizing..." in the output)
4. Verify the app is notarized

**Expected output during make:**
```
✔ Packaging application
❯ Notarizing application
  › Uploading to Apple...
  › Waiting for Apple to notarize...
  › Notarization successful
✔ Notarizing application
❯ Making distributables
```

## Why asar Was Disabled

The `asar: false` setting was added as a workaround for the Electron Forge Vite plugin not copying renderer files. This has been fixed with the `packageAfterCopy` hook, so asar can now be safely re-enabled.

## Additional Notes

- Notarization requires an active internet connection
- First-time notarization can take 5-10 minutes
- Subsequent notarizations are usually faster (2-5 minutes)
- The notarization ticket is "stapled" to the app automatically by Electron Forge
- Users downloading the app will see it as trusted by macOS Gatekeeper

## References

- [Electron Forge Code Signing Guide](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Apple Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [@electron/notarize](https://github.com/electron/notarize)

