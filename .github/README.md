# GitHub Actions Workflows

This directory contains automated workflows for building and distributing Gazel.

## Available Workflows

### 🍎 Build and Sign macOS App
**File**: `workflows/build-macos.yml`

Automatically builds, signs, and notarizes the macOS Electron app.

**Triggers:**
- Push to `main` or `master` branch
- Pull requests (build only, no signing)
- Version tags (e.g., `v1.0.0`) - creates GitHub releases
- Manual workflow dispatch

**What it does:**
1. ✅ Sets up macOS runner with Node.js and pnpm
2. ✅ Imports your Developer ID certificate
3. ✅ Configures Apple API key for notarization
4. ✅ Builds the Electron app
5. ✅ Signs the app with your Developer ID
6. ✅ Notarizes with Apple (2-10 minutes)
7. ✅ Creates distributable installers (ZIP/DMG)
8. ✅ Uploads artifacts (available for 30 days)
9. ✅ Creates GitHub releases for version tags

**Artifacts produced:**
- `Gazel-macOS-app` - Signed .app bundle
- `Gazel-macOS-installer` - Signed and notarized installer

## Setup Instructions

### First-Time Setup

1. **Read the setup guide**: [GITHUB_ACTIONS_SIGNING.md](../GITHUB_ACTIONS_SIGNING.md)
2. **Follow the checklist**: [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md)
3. **Add 5 required secrets** to your GitHub repository:
   - `APPLE_CERTIFICATE_BASE64`
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_API_KEY_BASE64`
   - `APPLE_API_KEY_ID`
   - `APPLE_API_ISSUER`

### Quick Start

After setup, the workflow runs automatically. To create a release:

```bash
# Tag your version
git tag v1.0.0
git push origin v1.0.0

# The workflow will:
# - Build and sign the app
# - Notarize with Apple
# - Create a GitHub release
# - Attach the signed installer
```

## Testing the Workflow

### Test Build (No Release)
```bash
# Push to main to trigger a build
git push origin main

# Or manually trigger from GitHub:
# Actions → Build and Sign macOS App → Run workflow
```

### Test Release
```bash
# Create a test tag
git tag v0.0.1-test
git push origin v0.0.1-test

# Check the Actions tab for progress
# Check the Releases page for the created release
```

## Monitoring Builds

1. Go to the **Actions** tab in your repository
2. Click on a workflow run to see details
3. Expand each step to view logs
4. Download artifacts from the workflow summary page

## Troubleshooting

### Build fails with "Certificate not found"
- Verify `APPLE_CERTIFICATE_BASE64` is correctly encoded
- Check `APPLE_CERTIFICATE_PASSWORD` is correct
- Ensure you exported the full certificate (not just public key)

### Build fails with "Notarization failed"
- Check API key permissions in App Store Connect
- Verify `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are correct
- Review workflow logs for specific Apple error messages

### Secrets not working
- Verify all 5 secrets are added (Settings → Secrets and variables → Actions)
- Check secret names match exactly (case-sensitive)
- Re-encode and re-add secrets if needed

## Security

- ✅ All secrets are encrypted by GitHub
- ✅ Secrets are never exposed in logs
- ✅ Temporary keychain is created and deleted for each build
- ✅ Sensitive files are cleaned up after build
- ✅ Only repository admins can view/edit secrets

## Cost

- **GitHub Actions**: Free for public repositories
- **Private repositories**: Included minutes vary by plan
- **macOS runners**: ~10x multiplier on minutes (e.g., 10 minutes = 100 minutes used)
- **Typical build time**: 10-15 minutes (including notarization)

## Customization

### Change trigger branches
Edit `workflows/build-macos.yml`:
```yaml
on:
  push:
    branches:
      - main
      - develop  # Add more branches
```

### Add scheduled builds
```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
```

### Modify artifact retention
```yaml
- uses: actions/upload-artifact@v4
  with:
    retention-days: 90  # Change from 30 to 90 days
```

## Additional Resources

- 📘 [Complete Setup Guide](../GITHUB_ACTIONS_SIGNING.md)
- ✅ [Secrets Checklist](SECRETS_CHECKLIST.md)
- 🔧 [Local Code Signing](../CODE_SIGNING_SETUP.md)
- 📖 [Electron Forge Docs](https://www.electronforge.io/guides/code-signing)
- 🍎 [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- 🤖 [GitHub Actions Docs](https://docs.github.com/en/actions)

## Support

If you encounter issues:
1. Check the workflow logs in the Actions tab
2. Review the troubleshooting sections in the guides
3. Verify all secrets are correctly configured
4. Test signing locally first: `source .env && pnpm make`
5. Open an issue with workflow logs attached

