# Quick Start: macOS Code Signing for Gazel

## TL;DR

To enable code signing for macOS builds, create a `.env` file with your credentials:

```bash
# Copy the example file
cp .env.codesigning.example .env

# Edit .env with your actual values (already pre-filled in the example)
# The file should contain:
APPLE_API_KEY=/Users/<username>/Downloads/AuthKey_XXXXXXXXX.p8
APPLE_API_KEY_ID=XXXXXXXXX
APPLE_API_ISSUER=69a6de7f-91fb-47e3-e053-5b8c7c11a4d1
```

Then build as normal:

```bash
# Load environment variables
source .env

# Package the app (signed)
pnpm package

# Or create installer (signed + notarized)
pnpm make
```

## What Was Changed

### 1. `electron/forge.config.ts`
Added code signing configuration to the `packagerConfig`:

```typescript
osxSign: {},  // Enable code signing
osxNotarize: process.env.APPLE_API_KEY && ... ? {
  appleApiKey: process.env.APPLE_API_KEY,
  appleApiKeyId: process.env.APPLE_API_KEY_ID,
  appleApiIssuer: process.env.APPLE_API_ISSUER,
} : undefined,
```

### 2. `.env.example`
Added documentation for the required environment variables.

### 3. `.env.codesigning.example`
Created with your specific credentials as a reference (not committed to git).

### 4. `CODE_SIGNING_SETUP.md`
Comprehensive documentation with troubleshooting and testing instructions.

## Testing the Configuration

### 1. Quick Test (Package Only)
```bash
source .env
pnpm package
```

This will create a signed `.app` bundle in the `out/` directory without notarization.

### 2. Full Test (Package + Notarize)
```bash
source .env
pnpm make
```

This will sign, notarize, and create a distributable installer. **Note**: Notarization takes several minutes.

### 3. Verify Signature
```bash
codesign --verify --deep --strict --verbose=2 out/Gazel-darwin-arm64/Gazel.app
```

Expected: `satisfies its Designated Requirement`

### 4. Check Notarization
```bash
spctl --assess --verbose=4 --type execute out/Gazel-darwin-arm64/Gazel.app
```

Expected: `accepted` with `source=Notarized Developer ID`

## Important Notes

✅ **Security**: The `.env` file is already in `.gitignore` and will not be committed

✅ **API Key Location**: The API key file should remain at `/Users/<username>/Downloads/AuthKey_XXXXXXXXX.p8`

✅ **Optional**: Code signing only runs when environment variables are set. Development builds work without them.

✅ **CI/CD Ready**: The configuration supports automated builds by setting environment variables in your CI system.

## Troubleshooting

**Problem**: "Certificate not found"
- **Solution**: Install your Developer ID Application certificate through Xcode
- **Check**: `security find-identity -p codesigning -v`

**Problem**: "API key file not found"
- **Solution**: Verify the path in `APPLE_API_KEY` is correct
- **Check**: `ls -la /Users/<username>/Downloads/AuthKey_XXXXXXXXX.p8`

**Problem**: Environment variables not loaded
- **Solution**: Run `source .env` before building
- **Check**: `echo $APPLE_API_KEY`

## Next Steps

1. **Create `.env` file**: `cp .env.codesigning.example .env`
2. **Test packaging**: `source .env && pnpm package`
3. **Test notarization**: `source .env && pnpm make` (takes several minutes)
4. **Verify signature**: Use the verification commands above

For detailed information, see `CODE_SIGNING_SETUP.md`.

