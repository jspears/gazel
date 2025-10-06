# macOS Code Signing Setup for Gazel

This document describes the code signing configuration for the Gazel Electron application on macOS.

## Overview

Code signing and notarization are required for distributing macOS applications:
- **Code Signing**: Certifies the identity of the app's author and ensures it hasn't been tampered with
- **Notarization**: Apple's automated malware scan required for macOS 10.15 (Catalina) and later

## Configuration Method

We're using **Option 2: App Store Connect API Key** from the [Electron Forge documentation](https://www.electronforge.io/guides/code-signing/code-signing-macos).

This method uses an API key for authentication instead of an app-specific password, which is more secure and doesn't require regeneration when your Apple ID password changes.

## Prerequisites

1. **Apple Developer Program Membership**: Required to obtain code signing certificates
2. **Xcode**: Install from the Mac App Store or [Apple Developer](https://developer.apple.com/xcode/)
3. **Code Signing Certificates**: Install your Developer ID Application certificate through Xcode
4. **App Store Connect API Key**: Generated from [App Store Connect](https://appstoreconnect.apple.com/access/integrations/api)

## Setup Instructions

### 1. Verify Your Code Signing Certificate

Check that your certificate is installed:

```bash
security find-identity -p codesigning -v
```

You should see your "Developer ID Application" certificate listed.

### 2. Configure Environment Variables

Copy the example configuration file:

```bash
cp .env.codesigning.example .env
```

The `.env` file should contain:

```bash
# Path to your App Store Connect API key file
APPLE_API_KEY=/Users/justinspears/Downloads/AuthKey_X8AQXQ8VJR.p8

# API Key ID (10-character alphanumeric string from the filename)
APPLE_API_KEY_ID=X8AQXQ8VJR

# API Issuer ID (UUID from App Store Connect)
APPLE_API_ISSUER=69a6de7f-91fb-47e3-e053-5b8c7c11a4d1
```

**Important Security Notes:**
- The `.env` file is already in `.gitignore` and will not be committed
- The API key file (`AuthKey_X8AQXQ8VJR.p8`) should remain in its current location
- Never commit the API key file or credentials to version control

### 3. Verify Configuration

The configuration is in `electron/forge.config.ts`:

```typescript
packagerConfig: {
  name: 'Gazel',
  executableName: 'gazel',
  icon: './assets/icon',
  asar: true,
  // macOS code signing
  osxSign: {},
  // macOS notarization (only enabled if APPLE_API_KEY is set)
  osxNotarize: process.env.APPLE_API_KEY ? {
    appleApiKey: process.env.APPLE_API_KEY,
    appleApiKeyId: process.env.APPLE_API_KEY_ID!,
    appleApiIssuer: process.env.APPLE_API_ISSUER!,
  } : undefined,
}
```

## Building and Signing

### Development Build (No Signing)

For local development, you can build without signing:

```bash
pnpm start
```

### Package with Code Signing

To create a signed package:

```bash
# Make sure environment variables are loaded
source .env

# Package the application (creates signed .app bundle)
pnpm package
```

The signed application will be in the `out/` directory.

### Create Signed Installer

To create a signed and notarized installer:

```bash
# Make sure environment variables are loaded
source .env

# Create distributable installer (DMG, ZIP, etc.)
pnpm make
```

This will:
1. Build the application
2. Sign the application with your Developer ID certificate
3. Upload to Apple for notarization
4. Wait for notarization to complete
5. Staple the notarization ticket to the app
6. Create the final installer

**Note**: Notarization can take several minutes to complete.

### Using Bazel

If using Bazel targets:

```bash
# Package
bazel run //electron:package

# Make installer
bazel run //electron:make
```

## Testing the Signed Application

### 1. Verify Code Signature

```bash
codesign --verify --deep --strict --verbose=2 out/Gazel-darwin-arm64/Gazel.app
```

Expected output: `satisfies its Designated Requirement`

### 2. Check Notarization Status

```bash
spctl --assess --verbose=4 --type execute out/Gazel-darwin-arm64/Gazel.app
```

Expected output: `accepted` with `source=Notarized Developer ID`

### 3. View Signature Details

```bash
codesign --display --verbose=4 out/Gazel-darwin-arm64/Gazel.app
```

## Troubleshooting

### Environment Variables Not Loaded

If you get signing errors, ensure environment variables are loaded:

```bash
# Check if variables are set
echo $APPLE_API_KEY
echo $APPLE_API_KEY_ID
echo $APPLE_API_ISSUER

# Load from .env file
source .env
```

### Certificate Not Found

If code signing fails with "certificate not found":

1. Verify certificate is installed: `security find-identity -p codesigning -v`
2. Install certificate through Xcode: Preferences > Accounts > Manage Certificates
3. Ensure you have "Developer ID Application" certificate (not "Mac App Store")

### Notarization Fails

If notarization fails:

1. Check API key permissions in App Store Connect
2. Verify API key file path is correct
3. Ensure API Key ID and Issuer ID are correct
4. Check notarization logs: `xcrun notarytool log <submission-id> --api-key <key-id> --api-issuer <issuer-id>`

### API Key File Not Found

If you get "API key file not found":

1. Verify the file exists at the path specified in `APPLE_API_KEY`
2. Check file permissions: `ls -la /Users/justinspears/Downloads/AuthKey_X8AQXQ8VJR.p8`
3. Ensure the path is absolute, not relative

## CI/CD Considerations

For automated builds in CI/CD:

1. Store the API key file as a secure secret in your CI system
2. Set environment variables in your CI configuration
3. Ensure the API key file is written to a temporary location during the build
4. Clean up the API key file after the build completes

Example for GitHub Actions:

```yaml
- name: Setup Code Signing
  env:
    APPLE_API_KEY_BASE64: ${{ secrets.APPLE_API_KEY_BASE64 }}
  run: |
    echo $APPLE_API_KEY_BASE64 | base64 --decode > /tmp/AuthKey.p8
    echo "APPLE_API_KEY=/tmp/AuthKey.p8" >> $GITHUB_ENV
    echo "APPLE_API_KEY_ID=${{ secrets.APPLE_API_KEY_ID }}" >> $GITHUB_ENV
    echo "APPLE_API_ISSUER=${{ secrets.APPLE_API_ISSUER }}" >> $GITHUB_ENV
```

## Alternative Authentication Methods

The current configuration uses the App Store Connect API key method (Option 2). Other methods are available:

### Option 1: App-Specific Password

Uses your Apple ID and an app-specific password. See [Electron Forge docs](https://www.electronforge.io/guides/code-signing/code-signing-macos#option-1-using-an-app-specific-password).

### Option 3: Keychain

Stores credentials in the macOS keychain. See [Electron Forge docs](https://www.electronforge.io/guides/code-signing/code-signing-macos#option-3-using-a-keychain).

## References

- [Electron Forge Code Signing Guide](https://www.electronforge.io/guides/code-signing)
- [Electron Forge macOS Signing](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
- [@electron/osx-sign Documentation](https://github.com/electron/osx-sign)
- [@electron/notarize Documentation](https://github.com/electron/notarize)

