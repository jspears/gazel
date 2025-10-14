# Gazel - Quick Reference Card

## 🚀 Common Commands

### Development
```bash
pnpm start              # Start Electron app with hot reload
pnpm dev                # Start web version (server + client)
pnpm dev:bazel          # Start with Bazel + iBazel
```

### Building
```bash
pnpm package            # Package app (unsigned)
pnpm make               # Create installer (unsigned)
```

### Building with Code Signing
```bash
source .env             # Load signing credentials
pnpm package            # Package signed app
pnpm make               # Create signed + notarized installer
```

### Icons
```bash
pnpm generate-icons     # Regenerate all icon files
```

## 📁 Important Files

### Configuration
- `electron/forge.config.ts` - Electron Forge configuration
- `electron/main.ts` - Main process entry point
- `.env` - Your credentials (not in git)
- `.env.example` - Template for environment variables

### Icons
- `assets/icon.png` - Source icon (1024x1024)
- `assets/icon.icns` - macOS icon bundle
- `assets/icon.ico` - Windows icon
- `electron/images/icon.png` - Original source

### Scripts
- `scripts/generate-icons.sh` - Icon generation script

## 🔧 Quick Fixes

### Icon Not Showing
```bash
pnpm generate-icons
pnpm package
```

### File Access Error
Already fixed! (`webSecurity: false` in `electron/main.ts`)

### Code Signing Issues
```bash
# Check credentials
echo $APPLE_API_KEY
echo $APPLE_API_KEY_ID
echo $APPLE_API_ISSUER

# Reload credentials
source .env

# Try again
pnpm package
```

## 📚 Documentation

### Quick Guides
- `MACOS_DISTRIBUTION_READY.md` - **Start here!** Complete overview
- `QUICK_START_CODE_SIGNING.md` - Code signing quick start
- `ELECTRON_FIXES_SUMMARY.md` - Summary of all fixes

### Detailed Guides
- `ICON_SETUP.md` - Icon configuration and generation
- `ICON_VERIFICATION.md` - Icon testing checklist
- `CODE_SIGNING_SETUP.md` - Complete code signing guide
- `ELECTRON_FILE_ACCESS_FIX.md` - File access fix details

## ✅ Status

- ✅ Icons configured for macOS, Windows, Linux
- ✅ File access permissions fixed
- ✅ Code signing configured
- ✅ Ready for distribution

## 🎯 Next Steps

1. **Test the app**: `pnpm start`
2. **Package the app**: `pnpm package`
3. **Set up signing**: Edit `.env` with your credentials
4. **Create installer**: `source .env && pnpm make`
5. **Distribute**: Share the signed app with users

## 🆘 Need Help?

See the detailed documentation files listed above, or check:
- [Electron Docs](https://www.electronjs.org/docs/latest/)
- [Electron Forge Docs](https://www.electronforge.io/)

