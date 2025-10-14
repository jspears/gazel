# Migration from yarn to Yarn

**Date:** 2025-10-14

## Overview

This project has been migrated from yarn to Yarn for better compatibility with Electron Forge and simpler CI/CD configuration.

## Changes Made

### 1. Configuration Files

#### `.npmrc`
**Before:**
```
package-manager=pnpm
node-linker=hoisted
shamefully-hoist=true
```

**After:**
```
package-manager=yarn
nodeLinker=node-modules
```

#### `package.json`
- Removed `pnpm` configuration section
- Added `workspaces` field to replace `pnpm-workspace.yaml`
- Added `"private": true` (required for yarn workspaces)

**Added:**
```json
{
  "private": true,
  "workspaces": [
    "app",
    "proto",
    "client",
    "server",
    "electron"
  ]
}
```

**Removed:**
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["electron"]
  }
}
```

#### Workspace Configuration
- **Deleted:** `pnpm-workspace.yaml`
- **Replaced with:** `workspaces` field in root `package.json`

### 2. Bazel Configuration

#### `MODULE.bazel`
Changed npm lock file reference:
```python
# Before:
npm.npm_translate_lock(
    name = "npm",
    pnpm_lock = "//:pnpm-lock.yaml",
)

# After:
npm.npm_translate_lock(
    name = "npm",
    yarn_lock = "//:yarn.lock",
)
```

#### `BUILD.bazel`
Updated exports:
```python
# Before:
exports_files([
    "pnpm-lock.yaml",
])

# After:
exports_files([
    "yarn.lock",
])
```

#### `app/BUILD.bazel`
Updated comments to reference yarn instead of pnpm.

### 3. GitHub Actions Workflow

#### `.github/workflows/build-macos.yml`

**Before:**
```yaml
- name: Install pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    cache: 'pnpm'

- name: Install dependencies
  run: yarn install --frozen-lockfile

- name: Build and Package App
  run: yarn exec electron-forge package
```

**After:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    cache: 'yarn'

- name: Install dependencies
  run: yarn install --frozen-lockfile

- name: Build and Package App
  run: yarn electron-forge package
```

**Benefits:**
- No separate yarn installation step needed (yarn comes with Node.js)
- Simpler workflow configuration
- No need for `yarn exec` workarounds

### 4. Documentation Updates

Updated all documentation files to use `yarn` commands instead of `pnpm`:
- `QUICK_REFERENCE.md`
- `RENDERER_NOT_LOADING_FIX.md`
- `docs/electron-ipc-integration.md`
- `.github/WORKFLOW_FIXES.md`
- And others...

## Migration Steps for Developers

If you're working on this project, follow these steps to migrate your local environment:

### 1. Clean Up yarn Files

```bash
# Remove yarn lock file and node_modules
rm -rf pnpm-lock.yaml
rm -rf node_modules
rm -rf */node_modules

# Remove yarn store (optional, frees up disk space)
rm -rf ~/.pnpm-store
```

### 2. Install Yarn (if not already installed)

Yarn should come with Node.js 16.10+. To verify:

```bash
yarn --version
```

If you need to install or update yarn:

```bash
# Enable Corepack (comes with Node.js 16.10+)
corepack enable

# Or install globally with npm
npm install -g yarn
```

### 3. Install Dependencies with Yarn

```bash
# Install all dependencies
yarn install

# This will create yarn.lock file
```

### 4. Verify Bazel Integration

```bash
# Generate proto files
bazel build //proto:index

# Test the build
yarn package
```

### 5. Update Your Scripts/Aliases

If you have any shell aliases or scripts that use `pnpm`, update them to use `yarn`:

```bash
# Before:
alias dev="yarn start"

# After:
alias dev="yarn start"
```

## Command Equivalents

| yarn Command | Yarn Equivalent |
|--------------|-----------------|
| `yarn install` | `yarn install` |
| `yarn install --frozen-lockfile` | `yarn install --frozen-lockfile` |
| `yarn add <package>` | `yarn add <package>` |
| `yarn add -D <package>` | `yarn add -D <package>` |
| `yarn remove <package>` | `yarn remove <package>` |
| `yarn run <script>` | `yarn <script>` |
| `yarn exec <command>` | `yarn <command>` |
| `yarn list` | `yarn list` |
| `yarn why <package>` | `yarn why <package>` |

## Benefits of Yarn

1. **Simpler CI/CD**: Yarn comes with Node.js, no separate installation needed
2. **Better Electron Forge compatibility**: No need for `yarn exec` workarounds
3. **Mature ecosystem**: Yarn has been around longer and has better tooling support
4. **Workspace support**: Yarn workspaces are well-established and widely used
5. **Faster in some cases**: Yarn can be faster for certain operations

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:**
```bash
rm -rf node_modules yarn.lock
yarn install
```

### Issue: Bazel can't find dependencies

**Solution:**
```bash
# Clean Bazel cache
bazel clean --expunge

# Reinstall dependencies
yarn install

# Rebuild
bazel build //proto:index
```

### Issue: Electron Forge errors

**Solution:**
```bash
# Make sure you're using yarn, not pnpm
yarn electron-forge package

# Not: yarn exec electron-forge package
```

## Rollback (if needed)

If you need to rollback to yarn for any reason:

1. Restore `pnpm-workspace.yaml`
2. Restore yarn configuration in `package.json`
3. Update `.npmrc` back to yarn settings
4. Update `MODULE.bazel` to use `pnpm_lock`
5. Run `yarn install`

However, the yarn migration should work better for this project.

## Questions?

If you encounter any issues with the migration, please:
1. Check this document first
2. Try the troubleshooting steps
3. Open an issue if the problem persists

