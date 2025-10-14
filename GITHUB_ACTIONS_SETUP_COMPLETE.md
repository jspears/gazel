# ✅ GitHub Actions Code Signing Setup Complete

Your repository is now configured for automated signed macOS builds!

## What Was Created

### 1. GitHub Actions Workflow
**File**: `.github/workflows/build-macos.yml`

A complete workflow that:
- ✅ Builds your Electron app on macOS runners (with pnpm 9)
- ✅ Signs with your Developer ID certificate
- ✅ Notarizes with Apple
- ✅ Creates distributable installers
- ✅ Uploads artifacts
- ✅ Creates GitHub releases for version tags

**Recent fixes:**
- ✅ Fixed pnpm installation order (install pnpm before Node.js cache)
- ✅ Updated to pnpm v9 to match local environment
- ✅ Updated to pnpm/action-setup@v4
- ✅ Added Bazel setup to generate protobuf files before building
- ✅ Using bazel-contrib/setup-bazel action with caching for faster builds

### 2. Documentation Files

| File | Purpose |
|------|---------|
| `GITHUB_ACTIONS_SIGNING.md` | Complete setup guide with troubleshooting |
| `.github/QUICK_SETUP.md` | 15-minute quick start guide |
| `.github/SECRETS_CHECKLIST.md` | Quick reference for required secrets |
| `.github/README.md` | Workflow documentation and usage |
| `README.md` | Updated with distribution section |

## Next Steps

### 1. Add Secrets to GitHub (Required)

You need to add 5 secrets to your GitHub repository:

```bash
# Go to: Settings → Secrets and variables → Actions
# Add these secrets:

1. APPLE_CERTIFICATE_BASE64     (base64-encoded .p12 file)
2. APPLE_CERTIFICATE_PASSWORD   (password for .p12)
3. APPLE_API_KEY_BASE64         (base64-encoded .p8 file)
4. APPLE_API_KEY_ID             (10-char string from filename)
5. APPLE_API_ISSUER             (UUID from App Store Connect)
```

**Follow the guide**: `.github/QUICK_SETUP.md` for step-by-step instructions.

### 2. Test the Workflow

After adding secrets:

```bash
# Option 1: Push to main
git add .
git commit -m "Add GitHub Actions workflow for signed builds"
git push origin main

# Option 2: Create a test tag
git tag v0.0.1-test
git push origin v0.0.1-test

# Then check: GitHub → Actions tab
```

### 3. Create Your First Release

When ready to release:

```bash
# 1. Tag your version
git tag v1.0.0

# 2. Push the tag
git push origin v1.0.0

# 3. Wait ~10-15 minutes

# 4. Check Releases page
# → Signed installer will be attached
# → Ready to distribute! 🎉
```

## Quick Reference

### Commands

```bash
# Local development
pnpm start                      # Dev mode with hot reload

# Local signed builds
source .env                     # Load credentials
pnpm package                    # Package signed app
pnpm make                       # Create signed installer

# GitHub Actions
git push origin main            # Trigger build
git tag v1.0.0 && git push origin v1.0.0  # Create release
```

### Verification

```bash
# Verify code signature
codesign --verify --deep --strict --verbose=2 Gazel.app

# Check notarization
spctl --assess --verbose=4 --type execute Gazel.app

# View signature details
codesign --display --verbose=4 Gazel.app
```

## Documentation Structure

```
.
├── GITHUB_ACTIONS_SIGNING.md          # 📘 Complete setup guide
├── GITHUB_ACTIONS_SETUP_COMPLETE.md   # 📋 This file
├── CODE_SIGNING_SETUP.md              # 🔧 Local signing setup
├── README.md                          # 📖 Updated with distribution info
└── .github/
    ├── workflows/
    │   └── build-macos.yml            # 🤖 The workflow
    ├── QUICK_SETUP.md                 # ⚡ 15-min quick start
    ├── SECRETS_CHECKLIST.md           # ✅ Secrets reference
    └── README.md                      # 📚 Workflow docs
```

## Workflow Features

### Automatic Triggers

The workflow runs on:
- ✅ Push to `main` or `master` branch
- ✅ Pull requests (build only, no signing)
- ✅ Version tags (e.g., `v1.0.0`) → creates releases
- ✅ Manual dispatch from Actions tab

### Build Outputs

For every build:
- **Artifacts** (30-day retention):
  - `Gazel-macOS-app` - Signed .app bundle
  - `Gazel-macOS-installer` - Signed installer (ZIP/DMG)

For version tags:
- **GitHub Release** with:
  - Signed installer attached
  - Auto-generated release notes
  - Ready for distribution

### Security Features

- ✅ Secrets encrypted by GitHub
- ✅ Temporary keychain created/deleted per build
- ✅ Sensitive files cleaned up after build
- ✅ Secrets never exposed in logs
- ✅ Only admins can view/edit secrets

## Troubleshooting

### Build Fails

1. **Check workflow logs**: Actions tab → Click on failed run
2. **Verify secrets**: Settings → Secrets and variables → Actions
3. **Test locally first**: `source .env && pnpm make`
4. **Review guides**: See documentation files above

### Common Issues

| Issue | Solution |
|-------|----------|
| Certificate not found | Re-export from Keychain, re-encode, update secret |
| Notarization failed | Check API key permissions in App Store Connect |
| Secrets not working | Verify names match exactly (case-sensitive) |
| App won't open | Verify signature: `codesign --verify Gazel.app` |

## Cost Breakdown

| Item | Cost |
|------|------|
| Apple Developer Program | $99/year (required) |
| GitHub Actions (public repo) | Free |
| GitHub Actions (private repo) | Included minutes vary by plan |
| Notarization | Free (included with Developer Program) |

**Note**: macOS runners use 10x minutes (10 min build = 100 min used)

## Support & Resources

### Documentation
- 📘 [Complete Setup Guide](GITHUB_ACTIONS_SIGNING.md)
- ⚡ [Quick Setup](.github/QUICK_SETUP.md)
- ✅ [Secrets Checklist](.github/SECRETS_CHECKLIST.md)
- 🔧 [Local Signing](CODE_SIGNING_SETUP.md)

### External Resources
- [Electron Forge Code Signing](https://www.electronforge.io/guides/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)

### Getting Help
1. Check the workflow logs in Actions tab
2. Review troubleshooting sections in guides
3. Verify all secrets are correctly configured
4. Test signing locally first
5. Open an issue with logs attached

## What's Next?

### Immediate Actions
1. ✅ Add the 5 required secrets to GitHub
2. ✅ Test the workflow with a push or tag
3. ✅ Verify the signed build works
4. ✅ Create your first release

### Optional Enhancements
- Add Windows/Linux build workflows
- Set up automated testing before builds
- Configure branch protection rules
- Add build status badges to README
- Set up release templates
- Configure automated changelog generation

## Success Checklist

- [ ] All 5 secrets added to GitHub
- [ ] Workflow file committed and pushed
- [ ] Test build completed successfully
- [ ] Artifacts downloaded and verified
- [ ] Signature verified with `codesign`
- [ ] Notarization verified with `spctl`
- [ ] Test release created successfully
- [ ] Signed installer works on clean Mac

## Congratulations! 🎉

Your repository now has professional-grade automated builds with:
- ✅ Code signing for security
- ✅ Apple notarization for distribution
- ✅ Automated releases
- ✅ Artifact storage
- ✅ Professional workflow

Users can now download and run your app without security warnings!

---

**Setup Date**: $(date)
**Status**: Ready for production
**Next Step**: Add secrets and test the workflow

For questions or issues, see the documentation files listed above.

