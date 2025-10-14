# Quick Setup Guide - GitHub Actions Code Signing

**Goal**: Set up automated signed macOS builds in ~15 minutes

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Apple Developer Program membership ($99/year)
- [ ] Developer ID Application certificate installed on your Mac
- [ ] App Store Connect API key (`.p8` file)
- [ ] Admin access to your GitHub repository

## 5-Step Setup

### Step 1: Export Certificate (5 min)

1. Open **Keychain Access** on your Mac
2. Find **"Developer ID Application: Your Name"**
3. Right-click → **Export** → Save as `certificate.p12`
4. Set a **strong password** (save it!)

### Step 2: Encode Files (2 min)

Open Terminal and run:

```bash
# Encode certificate
base64 -i ~/Downloads/certificate.p12 | pbcopy
# ✓ Copied to clipboard - paste as APPLE_CERTIFICATE_BASE64

# Encode API key (replace with your path)
base64 -i ~/Downloads/AuthKey_XXXXXXXXXX.p8 | pbcopy
# ✓ Copied to clipboard - paste as APPLE_API_KEY_BASE64
```

### Step 3: Gather Information (3 min)

Collect these values:

```bash
# 1. Certificate password
# → The password you set in Step 1
# → Save as: APPLE_CERTIFICATE_PASSWORD

# 2. API Key ID
ls ~/Downloads/AuthKey_*.p8
# AuthKey_ABC123DEFG.p8 → ABC123DEFG
# → Save as: APPLE_API_KEY_ID

# 3. API Issuer ID
# → Go to: https://appstoreconnect.apple.com/
# → Users and Access → Integrations → App Store Connect API
# → Copy the Issuer ID (UUID format)
# → Save as: APPLE_API_ISSUER
```

### Step 4: Add Secrets to GitHub (3 min)

1. Go to your repository on GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:

| Secret Name | Value |
|------------|-------|
| `APPLE_CERTIFICATE_BASE64` | Paste from Step 2 (certificate) |
| `APPLE_CERTIFICATE_PASSWORD` | Your certificate password |
| `APPLE_API_KEY_BASE64` | Paste from Step 2 (API key) |
| `APPLE_API_KEY_ID` | From Step 3 (e.g., `ABC123DEFG`) |
| `APPLE_API_ISSUER` | From Step 3 (UUID) |

### Step 5: Test the Workflow (2 min)

```bash
# Option A: Push to main
git push origin main

# Option B: Create a test tag
git tag v0.0.1-test
git push origin v0.0.1-test

# Then watch the build:
# → Go to Actions tab in GitHub
# → Click on the running workflow
# → Watch the magic happen! ✨
```

## Verification

After the workflow completes:

1. **Check Artifacts**:
   - Go to the workflow run
   - Scroll to "Artifacts" section
   - Download `Gazel-macOS-installer`

2. **Verify Signature**:
   ```bash
   # Extract and verify
   unzip Gazel-darwin-arm64-*.zip
   codesign --verify --deep --strict --verbose=2 Gazel.app
   # Should say: "satisfies its Designated Requirement"
   ```

3. **Check Notarization**:
   ```bash
   spctl --assess --verbose=4 --type execute Gazel.app
   # Should say: "accepted" with "source=Notarized Developer ID"
   ```

## What Happens Next?

### Automatic Builds

The workflow now runs automatically on:

- ✅ **Every push to main** → Builds and uploads artifacts
- ✅ **Every pull request** → Builds to verify (no signing)
- ✅ **Version tags** (e.g., `v1.0.0`) → Creates GitHub release

### Creating Releases

When you're ready to release:

```bash
# 1. Tag your version
git tag v1.0.0

# 2. Push the tag
git push origin v1.0.0

# 3. Wait ~10-15 minutes for:
#    - Build
#    - Sign
#    - Notarize (this takes the longest)
#    - Create GitHub release

# 4. Check your Releases page
#    - Signed installer is attached
#    - Release notes auto-generated
#    - Ready to share with users! 🎉
```

## Troubleshooting

### ❌ "Certificate not found"

**Fix**: Re-export certificate from Keychain Access
- Make sure to export the **certificate** (not just public key)
- Include the private key
- Use a strong password

### ❌ "Notarization failed"

**Fix**: Check API key permissions
1. Go to App Store Connect
2. Users and Access → Integrations
3. Click on your API key
4. Ensure it has proper access

### ❌ "Secrets not working"

**Fix**: Verify secret names
- Must match exactly (case-sensitive)
- No extra spaces
- All 5 secrets must be present

### ❌ Build succeeds but app won't open

**Fix**: Check Gatekeeper
```bash
# Remove quarantine attribute
xattr -cr Gazel.app

# Or verify notarization
spctl --assess --verbose=4 --type execute Gazel.app
```

## Common Questions

### Q: How long does a build take?
**A**: 10-15 minutes total (notarization takes 5-10 minutes)

### Q: How much does this cost?
**A**: 
- GitHub Actions: Free for public repos
- Apple Developer: $99/year (required)
- Notarization: Free

### Q: Can I test locally first?
**A**: Yes! Use your local setup:
```bash
source .env
pnpm make
```

### Q: What if I need to update my certificate?
**A**: 
1. Export new certificate from Keychain
2. Re-encode: `base64 -i certificate.p12 | pbcopy`
3. Update `APPLE_CERTIFICATE_BASE64` secret in GitHub

### Q: Can I build for Windows/Linux too?
**A**: Yes! You can add additional workflows for other platforms. The current workflow is macOS-specific because code signing is platform-specific.

## Next Steps

✅ **Setup complete!** Your repository now has automated signed builds.

**Recommended actions:**
1. Update your README with download links
2. Set up branch protection rules
3. Configure release templates
4. Add build status badges

**Learn more:**
- 📘 [Full Setup Guide](../GITHUB_ACTIONS_SIGNING.md)
- 🔧 [Local Code Signing](../CODE_SIGNING_SETUP.md)
- 📖 [Workflow Details](.github/README.md)

## Need Help?

- 📖 Check the [full documentation](../GITHUB_ACTIONS_SIGNING.md)
- 🐛 Review workflow logs in the Actions tab
- 💬 Open an issue with logs attached
- ✅ Verify all secrets are correctly set

---

**Estimated setup time**: 15 minutes
**Difficulty**: Intermediate
**One-time setup**: Yes (unless certificates expire)

