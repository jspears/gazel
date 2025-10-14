# Bazel + Yarn Setup Explanation

## The Challenge

When migrating from pnpm to Yarn, we encountered an issue with Bazel's `aspect_rules_js` integration. Here's what happened and how it was resolved.

## The Problem

1. **Yarn for Development**: We wanted to use Yarn as the package manager for development (simpler CI/CD, better Electron Forge compatibility)

2. **Bazel Requires pnpm-lock.yaml**: Bazel's `aspect_rules_js` works best with `pnpm-lock.yaml` format because:
   - It has detailed workspace information
   - It includes lifecycle hook metadata (in pnpm v8 and earlier)
   - It's the native format for aspect_rules_js

3. **Conversion Issues**: When Bazel tried to convert `yarn.lock` to `pnpm-lock.yaml` automatically:
   - Workspace structure was lost
   - Build failed with: "Projects are discovered from the pnpm-lock.yaml and may be missing"

## The Solution

**Use Yarn for development, but maintain a pnpm-lock.yaml for Bazel.**

### Setup Steps

1. **Keep both lock files**:
   - `yarn.lock` - Used by developers and CI/CD for installing dependencies
   - `pnpm-lock.yaml` - Used by Bazel for build system integration

2. **Maintain pnpm-workspace.yaml**:
   ```yaml
   packages:
     - 'app'
     - 'proto'
     - 'client'
     - 'server'
     - 'electron'
   ```

3. **Add pnpm.onlyBuiltDependencies to package.json**:
   ```json
   {
     "pnpm": {
       "onlyBuiltDependencies": [
         "electron",
         "protobufjs",
         "esbuild",
         "electron-winstaller",
         "svelte-preprocess",
         "@bufbuild/buf"
       ]
     }
   }
   ```
   
   This is required for pnpm v9+ because the lockfile no longer includes `requiresBuild` metadata.

4. **Configure MODULE.bazel**:
   ```python
   npm.npm_translate_lock(
       name = "npm",
       npmrc = "//:.npmrc",
       pnpm_lock = "//:pnpm-lock.yaml",  # Use pnpm-lock.yaml
       verify_node_modules_ignored = "//:.bazelignore",
   )
   ```

## Workflow

### For Developers

**Use Yarn for all development tasks:**

```bash
# Install dependencies
yarn install

# Run development server
yarn start

# Package the app
yarn package

# Create installer
yarn make
```

### For Bazel

**Bazel uses pnpm-lock.yaml automatically:**

```bash
# Build proto files
bazel build //proto:index

# Bazel reads pnpm-lock.yaml and manages dependencies internally
```

### Keeping Lock Files in Sync

When you add/remove/update dependencies:

```bash
# 1. Update with yarn (for development)
yarn add some-package
yarn install

# 2. Regenerate pnpm-lock.yaml (for Bazel)
pnpm install --lockfile-only

# 3. Commit both lock files
git add yarn.lock pnpm-lock.yaml
git commit -m "Add some-package"
```

## Why This Works

1. **Yarn for Development**:
   - Simpler CI/CD (comes with Node.js)
   - Better Electron Forge compatibility
   - No `pnpm exec` workarounds needed
   - Faster in many cases

2. **pnpm-lock.yaml for Bazel**:
   - Contains complete workspace structure
   - Includes lifecycle hook information (via onlyBuiltDependencies)
   - Native format for aspect_rules_js
   - Bazel can efficiently parse and use it

3. **Both Lock Files Stay in Sync**:
   - Both are generated from the same package.json files
   - Both resolve to the same dependency versions
   - pnpm-lock.yaml is only used by Bazel, not installed by developers

## Files to Maintain

### For Yarn (Development)
- `package.json` (with workspaces field)
- `yarn.lock`
- `.yarnrc.yml`

### For pnpm (Bazel Only)
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `package.json` (with pnpm.onlyBuiltDependencies)

### For Bazel
- `MODULE.bazel` (references pnpm-lock.yaml)
- `BUILD.bazel` (exports pnpm-lock.yaml)

## CI/CD Configuration

GitHub Actions workflow uses Yarn 4.10.3+ (specified in package.json):

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'yarn'

- name: Enable Corepack and Setup Yarn
  run: |
    corepack enable
    yarn --version

- name: Install dependencies
  run: yarn install --frozen-lockfile

- name: Generate proto files (Bazel uses pnpm-lock.yaml)
  run: bazel build //proto:index

- name: Build and Package App
  run: yarn electron-forge package
```

The Yarn version is controlled by the `packageManager` field in package.json:
```json
{
  "packageManager": "yarn@4.10.3"
}
```

## Benefits

✅ **Simple Development**: Developers only use `yarn` commands  
✅ **Simple CI/CD**: No separate pnpm installation needed  
✅ **Bazel Integration**: Works perfectly with aspect_rules_js  
✅ **Workspace Support**: Both tools understand the monorepo structure  
✅ **Version Consistency**: Both lock files resolve to same versions  

## Troubleshooting

### Issue: Bazel can't find packages

**Solution**: Regenerate pnpm-lock.yaml
```bash
pnpm install --lockfile-only
```

### Issue: Lock files out of sync

**Solution**: Regenerate both
```bash
yarn install
pnpm install --lockfile-only
git add yarn.lock pnpm-lock.yaml
```

### Issue: Missing onlyBuiltDependencies error

**Solution**: Add packages with lifecycle hooks to package.json:
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["electron", "protobufjs", "esbuild", ...]
  }
}
```

## Summary

This hybrid approach gives us the best of both worlds:
- **Yarn** for simple, fast development and CI/CD
- **pnpm-lock.yaml** for robust Bazel integration

Both lock files are committed to source control and kept in sync when dependencies change.

