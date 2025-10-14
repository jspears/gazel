# GitHub Actions Code Signing Setup for macOS

This guide explains how to set up automated signed builds for Gazel on GitHub Actions.

## Overview

The GitHub Actions workflow (`.github/workflows/build-macos.yml`) automatically:
- ✅ Builds your Electron app on macOS runners
- ✅ Signs the app with your Developer ID certificate
- ✅ Notarizes the app with Apple
- ✅ Creates distributable installers (ZIP/DMG)
- ✅ Uploads build artifacts
- ✅ Creates GitHub releases for version tags

## Prerequisites

Before setting up GitHub Actions, you need:

1. **Apple Developer Program membership** ($99/year)
2. **Developer ID Application certificate** installed locally
3. **App Store Connect API key** (already configured locally)
4. **GitHub repository** with admin access

## Step-by-Step Setup

### Step 1: Export Your Code Signing Certificate

You need to export your Developer ID Application certificate from your Mac's Keychain:

1. Open **Keychain Access** (Applications → Utilities → Keychain Access)
2. In the left sidebar, select **login** keychain
3. Select **My Certificates** category
4. Find your **"Developer ID Application: Your Name (Team ID)"** certificate
5. Right-click the certificate → **Export "Developer ID Application..."**
6. Save as: `certificate.p12`
7. **Set a strong password** (you'll need this later)
8. Click **Save**

### Step 2: Encode Your Secrets

Open Terminal and run these commands:

#### Encode the Certificate:
```bash
base64 -i ~/Downloads/certificate.p12 | pbcopy
```
This copies the base64-encoded certificate to your clipboard.

#### Encode the API Key:
```bash
# Replace with your actual API key path
base64 -i /Users/yourusername/Downloads/AuthKey_XXXXXXXXXX.p8 | pbcopy
```
This copies the base64-encoded API key to your clipboard.

### Step 3: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each of the following secrets:

#### Required Secrets:

| Secret Name | Value | How to Get |
|------------|-------|------------|
| `APPLE_CERTIFICATE_BASE64` | Base64-encoded .p12 file | From Step 2 (certificate) |
| `APPLE_CERTIFICATE_PASSWORD` | Password for .p12 file | The password you set in Step 1 |
| `APPLE_API_KEY_BASE64` | Base64-encoded .p8 file | From Step 2 (API key) |
| `APPLE_API_KEY_ID` | API Key ID (e.g., `ABC123DEFG`) | From your API key filename: `AuthKey_ABC123DEFG.p8` |
| `APPLE_API_ISSUER` | Issuer ID (UUID format) | From App Store Connect (see below) |

#### Finding Your API Issuer ID:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **Users and Access**
3. Click **Integrations** tab
4. Click **App Store Connect API**
5. Find **Issuer ID** (looks like: `69a6de7f-91fb-47e3-e053-5b8c7c11a4d1`)

### Step 4: Verify Secrets

After adding all secrets, you should have 5 secrets configured:

```
✓ APPLE_CERTIFICATE_BASE64
✓ APPLE_CERTIFICATE_PASSWORD
✓ APPLE_API_KEY_BASE64
✓ APPLE_API_KEY_ID
✓ APPLE_API_ISSUER
```

## Using the Workflow

### Automatic Builds

The workflow runs automatically on:

- **Push to main/master branch**: Builds and uploads artifacts
- **Pull requests**: Builds to verify (no signing)
- **Version tags** (e.g., `v1.0.0`): Builds, signs, and creates a GitHub release

### Manual Builds

You can also trigger builds manually:

1. Go to **Actions** tab in your repository
2. Select **Build and Sign macOS App** workflow
3. Click **Run workflow**
4. Select the branch
5. Click **Run workflow**

### Creating a Release

To create a signed release:

```bash
# Tag your release
git tag v1.0.0
git push origin v1.0.0
```

The workflow will:
1. Build and sign the app
2. Notarize with Apple (takes 2-10 minutes)
3. Create a GitHub release
4. Attach the signed installer to the release

## Workflow Outputs

After a successful build, you'll find:

### Artifacts (for all builds)
- **Gazel-macOS-app**: The signed .app bundle
- **Gazel-macOS-installer**: The signed and notarized installer (ZIP/DMG)

Artifacts are available for 30 days in the Actions tab.

### Releases (for version tags)
- Automatically created GitHub release
- Signed installer attached as release asset
- Release notes auto-generated from commits

## Verifying Signed Builds

After downloading a build artifact:

```bash
# Verify code signature
codesign --verify --deep --strict --verbose=2 Gazel.app

# Check notarization
spctl --assess --verbose=4 --type execute Gazel.app

# View signature details
codesign --display --verbose=4 Gazel.app
```

Expected output:
- ✅ `satisfies its Designated Requirement`
- ✅ `accepted` with `source=Notarized Developer ID`

## Troubleshooting

### Build Fails: "Certificate not found"

**Problem**: The certificate wasn't imported correctly.

**Solution**:
1. Verify `APPLE_CERTIFICATE_BASE64` is correctly encoded
2. Check `APPLE_CERTIFICATE_PASSWORD` is correct
3. Ensure you exported the full certificate (not just the public key)

### Build Fails: "Notarization failed"

**Problem**: Apple rejected the notarization.

**Solution**:
1. Check the workflow logs for the specific error
2. Verify API key has correct permissions in App Store Connect
3. Ensure `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are correct
4. Check that your Developer ID certificate is valid

### Build Succeeds but App Won't Open

**Problem**: The app isn't properly signed or notarized.

**Solution**:
1. Download the artifact and verify signature (see above)
2. Check workflow logs for signing/notarization warnings
3. Ensure you're testing on macOS 10.15+ (Catalina or later)

### Secrets Not Working

**Problem**: Environment variables aren't being set.

**Solution**:
1. Verify all 5 secrets are added to GitHub
2. Check secret names match exactly (case-sensitive)
3. Re-encode and re-add secrets if needed

## Security Best Practices

✅ **DO:**
- Keep your certificate password strong and unique
- Rotate your API key periodically
- Use repository secrets (never commit credentials)
- Limit access to repository settings

❌ **DON'T:**
- Share your .p12 file or API key
- Commit secrets to the repository
- Use the same password for multiple certificates
- Give API keys more permissions than needed

## Cost Considerations

- **GitHub Actions**: Free for public repositories, included minutes for private repos
- **Apple Developer Program**: $99/year (required)
- **Notarization**: Free (included with Developer Program)

## Workflow Customization

### Change Trigger Branches

Edit `.github/workflows/build-macos.yml`:

```yaml
on:
  push:
    branches:
      - main
      - develop  # Add more branches
```

### Build on Schedule

Add a schedule trigger:

```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday at midnight
```

### Skip Notarization for Testing

For faster test builds, you can temporarily disable notarization by commenting out the "Create Signed Installer" step. However, the app won't be distributable without notarization.

## Additional Resources

- [Electron Forge Code Signing](https://www.electronforge.io/guides/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)

## Support

If you encounter issues:

1. Check the workflow logs in the Actions tab
2. Review the troubleshooting section above
3. Verify all secrets are correctly configured
4. Test signing locally first with `source .env && pnpm make`

## Next Steps

After setup:

1. ✅ Push a commit to trigger a test build
2. ✅ Verify the build succeeds and artifacts are uploaded
3. ✅ Download and test the signed app
4. ✅ Create a version tag to test release creation
5. ✅ Share the signed installer with users!

