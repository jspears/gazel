# GitHub Actions Troubleshooting Guide

Common issues and solutions for the macOS build workflow.

## Build Failures

### ❌ "Unable to locate executable file: pnpm"

**Error:**
```
Error: Unable to locate executable file: pnpm. Please verify either the file path exists...
```

**Cause:** pnpm is not installed before Node.js tries to use it for caching.

**Solution:** ✅ Already fixed in the workflow! The workflow now:
1. Installs pnpm first
2. Then sets up Node.js with pnpm cache
3. Then installs dependencies

**If you still see this error:**
```yaml
# Make sure your workflow has this order:
- name: Install pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
```

---

### ❌ "Certificate not found"

**Error:**
```
error: The specified item could not be found in the keychain.
```

**Cause:** The certificate wasn't imported correctly or the secret is invalid.

**Solutions:**

1. **Verify the certificate secret:**
   ```bash
   # Re-export from Keychain Access
   # Make sure to export the CERTIFICATE (not just public key)
   # Include the private key
   
   # Re-encode
   base64 -i ~/Downloads/certificate.p12 | pbcopy
   
   # Update APPLE_CERTIFICATE_BASE64 in GitHub Secrets
   ```

2. **Check the certificate password:**
   - Verify `APPLE_CERTIFICATE_PASSWORD` is correct
   - Try exporting a new certificate with a different password

3. **Verify certificate type:**
   - Must be "Developer ID Application" (not "Mac App Store")
   - Check in Keychain Access: My Certificates

---

### ❌ "Notarization failed"

**Error:**
```
Error: Notarization failed with status: Invalid
```

**Cause:** Apple rejected the notarization request.

**Solutions:**

1. **Check API key permissions:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Users and Access → Integrations → App Store Connect API
   - Ensure the key has proper access

2. **Verify API credentials:**
   ```bash
   # Check your secrets match:
   # - APPLE_API_KEY_ID: 10-character string from filename
   # - APPLE_API_ISSUER: UUID from App Store Connect
   ```

3. **Check notarization logs:**
   - Look in the workflow logs for the specific error
   - Apple provides detailed error messages

4. **Common notarization issues:**
   - Hardened runtime not enabled (✅ already configured)
   - Missing entitlements (✅ already configured)
   - Invalid bundle identifier
   - Unsigned dependencies

---

### ❌ "Could not resolve ./gazel_pb.js"

**Error:**
```
Could not resolve "./gazel_pb.js" from "proto/index.ts"
```

**Cause:** Protobuf files haven't been generated yet.

**Solution:** ✅ Already fixed in the workflow! The workflow now:
1. Installs Bazel (via Bazelisk)
2. Generates proto files with `bazel build //proto:index`
3. Then builds the Electron app

**If you still see this error:**
- Check that Bazel installation step completed successfully
- Verify proto generation step shows "✓ Proto files generated"
- Ensure `bazel-bin/proto/` directory contains generated files

---

### ❌ "pnpm install failed"

**Error:**
```
ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/...
```

**Cause:** Dependency not found or network issue.

**Solutions:**

1. **Check if it works locally:**
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Update lockfile if needed:**
   ```bash
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "Update pnpm lockfile"
   git push
   ```

3. **Check for private packages:**
   - If using private npm packages, add `NPM_TOKEN` secret
   - Configure `.npmrc` in the workflow

---

### ❌ "Build succeeded but artifacts missing"

**Error:** Workflow completes but no artifacts uploaded.

**Cause:** Build output path is incorrect.

**Solutions:**

1. **Check build output:**
   - Look at "List Build Artifacts" step in logs
   - Verify files exist in `out/` directory

2. **Verify paths in workflow:**
   ```yaml
   - name: Upload Installer
     uses: actions/upload-artifact@v4
     with:
       path: |
         out/make/**/*.zip
         out/make/**/*.dmg
   ```

3. **Check Electron Forge config:**
   - Verify `electron/forge.config.ts` output paths
   - Ensure makers are configured correctly

---

## Secret Issues

### ❌ "Secrets not working"

**Symptoms:** Build fails with authentication errors.

**Solutions:**

1. **Verify all 5 secrets exist:**
   - Go to: Settings → Secrets and variables → Actions
   - Should see:
     - `APPLE_CERTIFICATE_BASE64`
     - `APPLE_CERTIFICATE_PASSWORD`
     - `APPLE_API_KEY_BASE64`
     - `APPLE_API_KEY_ID`
     - `APPLE_API_ISSUER`

2. **Check secret names (case-sensitive):**
   - Must match exactly as shown above
   - No extra spaces or characters

3. **Re-encode secrets:**
   ```bash
   # Certificate
   base64 -i certificate.p12 | pbcopy
   
   # API Key
   base64 -i AuthKey_XXXXX.p8 | pbcopy
   ```

4. **Verify no extra whitespace:**
   - When pasting, ensure no trailing newlines
   - Secrets should be pure base64 strings

---

## Runtime Issues

### ❌ "Workflow takes too long"

**Symptoms:** Build times out or takes 30+ minutes.

**Causes & Solutions:**

1. **Notarization is slow (normal):**
   - Apple notarization takes 5-10 minutes
   - This is expected and unavoidable
   - Total build time: 10-15 minutes is normal

2. **Dependency installation slow:**
   - Ensure pnpm cache is working
   - Check "Setup Node.js" step shows "Cache restored"

3. **Multiple builds running:**
   - GitHub Actions queues builds
   - Check Actions tab for running workflows

---

### ❌ "App won't open after download"

**Symptoms:** Downloaded app shows security warning or won't open.

**Solutions:**

1. **Verify signature:**
   ```bash
   codesign --verify --deep --strict --verbose=2 Gazel.app
   # Should say: "satisfies its Designated Requirement"
   ```

2. **Check notarization:**
   ```bash
   spctl --assess --verbose=4 --type execute Gazel.app
   # Should say: "accepted" with "source=Notarized Developer ID"
   ```

3. **Remove quarantine (for testing):**
   ```bash
   xattr -cr Gazel.app
   ```

4. **Check workflow logs:**
   - Verify "Verify Code Signature" step passed
   - Check for any warnings during signing

---

## Workflow Configuration Issues

### ❌ "Workflow doesn't trigger"

**Symptoms:** Push to main but no workflow runs.

**Solutions:**

1. **Check workflow file location:**
   - Must be in `.github/workflows/`
   - File must have `.yml` or `.yaml` extension

2. **Verify branch name:**
   ```yaml
   on:
     push:
       branches:
         - main  # or master
   ```

3. **Check Actions are enabled:**
   - Settings → Actions → General
   - Ensure "Allow all actions" is selected

4. **Verify file is committed:**
   ```bash
   git ls-files .github/workflows/
   # Should show: build-macos.yml
   ```

---

### ❌ "Release not created for tags"

**Symptoms:** Tag pushed but no release created.

**Solutions:**

1. **Check tag format:**
   ```bash
   # Must start with 'v'
   git tag v1.0.0  # ✅ Correct
   git tag 1.0.0   # ❌ Won't trigger release
   ```

2. **Verify workflow completed:**
   - Check Actions tab
   - Ensure all steps passed

3. **Check GITHUB_TOKEN permissions:**
   - Should be automatic
   - If using custom token, ensure it has `contents: write`

---

## Performance Optimization

### Faster Builds

1. **Use dependency caching (already enabled):**
   ```yaml
   - uses: actions/setup-node@v4
     with:
       cache: 'pnpm'  # ✅ Enabled
   ```

2. **Skip notarization for testing:**
   - Comment out "Create Signed Installer" step
   - Use "Build and Package App" only
   - ⚠️ App won't be distributable without notarization

3. **Limit workflow triggers:**
   ```yaml
   on:
     push:
       branches:
         - main
       paths-ignore:
         - '**.md'  # Skip docs-only changes
   ```

---

## Getting Help

### Debug Checklist

Before asking for help:

- [ ] Check workflow logs in Actions tab
- [ ] Verify all 5 secrets are set correctly
- [ ] Test signing locally: `source .env && pnpm make`
- [ ] Check this troubleshooting guide
- [ ] Review the setup guides

### Useful Commands

```bash
# Test local build
pnpm package

# Test local signing
source .env
pnpm make

# Verify certificate locally
security find-identity -p codesigning -v

# Check pnpm version
pnpm --version

# View workflow file
cat .github/workflows/build-macos.yml
```

### Where to Get Help

1. **Check documentation:**
   - [GITHUB_ACTIONS_SIGNING.md](../GITHUB_ACTIONS_SIGNING.md)
   - [QUICK_SETUP.md](QUICK_SETUP.md)
   - [SECRETS_CHECKLIST.md](SECRETS_CHECKLIST.md)

2. **Review workflow logs:**
   - Actions tab → Click on failed run
   - Expand each step to see details

3. **Open an issue:**
   - Include workflow logs
   - Describe what you tried
   - Mention which guide you followed

---

## Common Workflow Patterns

### Test Before Release

```yaml
# Add a test job before build
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build-macos:
    needs: test  # Wait for tests to pass
    runs-on: macos-latest
    # ... rest of build steps
```

### Build on Multiple Branches

```yaml
on:
  push:
    branches:
      - main
      - develop
      - release/*
```

### Skip CI for Docs

```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

---

**Last Updated:** 2025-10-14
**Workflow Version:** 1.0

