# GitHub Secrets Setup Checklist

Quick reference for setting up GitHub Actions code signing secrets.

## Required Secrets (5 total)

### 1. APPLE_CERTIFICATE_BASE64
- **What**: Your Developer ID Application certificate
- **Format**: Base64-encoded .p12 file
- **How to get**:
  ```bash
  # Export certificate from Keychain Access as .p12
  # Then encode it:
  base64 -i ~/Downloads/certificate.p12 | pbcopy
  ```

### 2. APPLE_CERTIFICATE_PASSWORD
- **What**: Password for the .p12 certificate file
- **Format**: Plain text password
- **How to get**: The password you set when exporting the certificate

### 3. APPLE_API_KEY_BASE64
- **What**: Your App Store Connect API key
- **Format**: Base64-encoded .p8 file
- **How to get**:
  ```bash
  base64 -i /path/to/AuthKey_XXXXXXXXXX.p8 | pbcopy
  ```

### 4. APPLE_API_KEY_ID
- **What**: The API Key ID
- **Format**: 10-character alphanumeric string (e.g., `ABC123DEFG`)
- **How to get**: From the API key filename: `AuthKey_ABC123DEFG.p8`

### 5. APPLE_API_ISSUER
- **What**: The API Issuer ID
- **Format**: UUID (e.g., `69a6de7f-91fb-47e3-e053-5b8c7c11a4d1`)
- **How to get**: 
  1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
  2. Users and Access → Integrations → App Store Connect API
  3. Copy the Issuer ID

## Quick Setup Commands

```bash
# 1. Export and encode certificate
# (Do this in Keychain Access GUI, then:)
base64 -i ~/Downloads/certificate.p12 | pbcopy
# → Paste as APPLE_CERTIFICATE_BASE64

# 2. Encode API key
base64 -i /path/to/AuthKey_XXXXXXXXXX.p8 | pbcopy
# → Paste as APPLE_API_KEY_BASE64

# 3. Get API Key ID from filename
ls ~/Downloads/AuthKey_*.p8
# AuthKey_ABC123DEFG.p8 → ABC123DEFG is your APPLE_API_KEY_ID

# 4. Get Issuer ID from App Store Connect
# → Copy from web interface as APPLE_API_ISSUER

# 5. Remember your certificate password
# → Add as APPLE_CERTIFICATE_PASSWORD
```

## Verification

After adding secrets, verify in GitHub:
- Go to: Settings → Secrets and variables → Actions
- You should see 5 secrets listed
- Secret values are hidden (this is correct)

## Testing

After setup, test the workflow:

```bash
# Option 1: Push to main
git push origin main

# Option 2: Manual trigger
# Go to Actions tab → Build and Sign macOS App → Run workflow

# Option 3: Create a test tag
git tag v0.0.1-test
git push origin v0.0.1-test
```

## Security Notes

- ✅ Secrets are encrypted by GitHub
- ✅ Secrets are never exposed in logs
- ✅ Only repository admins can view/edit secrets
- ❌ Never commit the .p12 or .p8 files to git
- ❌ Never share your certificate password

## Troubleshooting

If secrets aren't working:

1. **Check secret names** - They must match exactly (case-sensitive)
2. **Re-encode files** - Ensure no extra whitespace or newlines
3. **Verify certificate** - Must be "Developer ID Application" (not Mac App Store)
4. **Check API key permissions** - Must have proper access in App Store Connect
5. **Test locally first** - Ensure `source .env && pnpm make` works

## Need Help?

See the full guide: [GITHUB_ACTIONS_SIGNING.md](../GITHUB_ACTIONS_SIGNING.md)

