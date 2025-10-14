# Bazel Executable Configuration

## Overview

Gazel now includes a Settings UI that allows users to configure the path to their Bazel or Bazelisk executable. This solves the issue where the packaged Electron app couldn't find `bazelisk` in the system PATH.

## Features

### 1. **Auto-Detection on Startup**
When Gazel starts, it automatically:
- Tries to find `bazelisk` in the system PATH first
- Falls back to `bazel` if `bazelisk` is not found
- Verifies the executable works by running `bazel version`
- Stores the detected path in localStorage for future use

### 2. **Settings UI**
Users can access the Settings modal by clicking the Settings icon (⚙️) in the top-right corner of the app.

The Settings UI provides:
- **Input field** to specify a custom Bazel executable path
- **Verify button** to test if the executable works
- **Auto-detect behavior** when the field is left empty
- **Visual feedback** showing the detected/verified path
- **Error messages** if verification fails

### 3. **Persistent Configuration**
- Settings are stored in browser localStorage
- Configuration is sent to the server on app startup
- Changes take effect immediately after saving

## Implementation Details

### Client-Side Changes

#### 1. **Settings Component** (`client/components/Settings.svelte`)
- Modal dialog with Bazel executable configuration
- Input field with "Verify" button
- Shows detected path after verification
- Displays success/error messages
- Stores settings in localStorage

#### 2. **App Initialization** (`client/App.svelte`)
- Added `initializeBazelExecutable()` function that runs on mount
- Loads stored executable from localStorage
- Sends configuration to server via gRPC
- Shows Settings modal if Bazel is not found
- Settings icon wired to open the Settings modal

#### 3. **Storage Service** (`client/lib/storage.ts`)
- Added `bazelExecutable` to preferences interface
- Persists user's Bazel executable preference

### Server-Side Changes

#### 1. **Configuration** (`server/config.ts`)
- Added `findBazelExecutable()` function that:
  - Checks `BAZEL_EXECUTABLE` environment variable
  - Uses `which bazelisk` to find bazelisk
  - Falls back to `which bazel`
  - Returns full path to executable
- Added `setBazelExecutable()` function to update config dynamically
- Auto-detects Bazel executable on server startup

#### 2. **Bazel Service** (`server/services/bazel.ts`)
- Added `setBazelExecutable()` method to update executable path
- Clears query cache when executable changes

#### 3. **gRPC Service** (`server/server.ts`)
- Added `updateBazelExecutable()` RPC method
- Verifies executable by running `bazel version`
- Returns success/failure with detected path

### Protocol Buffer Changes

#### **Proto Definition** (`proto/gazel.proto`)
Added new RPC and messages:

```protobuf
// Configuration messages
message UpdateBazelExecutableRequest {
  string executable = 1; // Path to bazel/bazelisk executable (empty for auto-detect)
}

message UpdateBazelExecutableResponse {
  bool success = 1;
  string message = 2;
  string detected_path = 3; // The actual path being used after resolution
}

// Service
service GazelService {
  // ... existing RPCs ...
  
  // Configuration operations
  rpc UpdateBazelExecutable(UpdateBazelExecutableRequest) returns (UpdateBazelExecutableResponse);
}
```

## User Experience

### First Launch (Bazel Found)
1. App starts
2. Auto-detects bazelisk at `/opt/homebrew/bin/bazelisk`
3. Verifies it works
4. Saves to localStorage
5. App works normally

### First Launch (Bazel Not Found)
1. App starts
2. Fails to find bazelisk or bazel
3. Settings modal automatically opens after 1 second
4. User enters path to Bazel executable
5. User clicks "Verify" to test
6. User clicks "Save Settings"
7. App works normally

### Changing Configuration
1. User clicks Settings icon (⚙️)
2. Settings modal opens
3. User enters new path or leaves empty for auto-detect
4. User clicks "Verify" to test (optional)
5. User clicks "Save Settings"
6. Configuration takes effect immediately

## Error Handling

### Verification Failures
If the Bazel executable cannot be verified:
- Error message shows the specific failure reason
- User can try a different path
- App continues to work with previous configuration

### Common Error Messages
- `"command not found"` - Executable doesn't exist in PATH
- `"verification failed"` - Executable exists but doesn't work
- `"Failed to update Bazel executable"` - Server-side error

## Testing

### Manual Testing
1. **Test auto-detection:**
   ```bash
   rm -rf out/ && yarn package
   out/Gazel-darwin-arm64/Gazel.app/Contents/MacOS/Gazel
   ```
   Check console output for: `[config] Found bazelisk at: /path/to/bazelisk`

2. **Test Settings UI:**
   - Open app
   - Click Settings icon
   - Enter custom path
   - Click "Verify"
   - Click "Save Settings"

3. **Test with Bazel not in PATH:**
   - Temporarily rename bazelisk: `mv /opt/homebrew/bin/bazelisk /opt/homebrew/bin/bazelisk.bak`
   - Launch app
   - Settings modal should open automatically
   - Restore: `mv /opt/homebrew/bin/bazelisk.bak /opt/homebrew/bin/bazelisk`

## Future Enhancements

Potential improvements:
- Add file picker dialog to browse for Bazel executable
- Show Bazel version in Settings UI
- Add "Test Connection" button that runs a simple query
- Support for multiple Bazel versions per workspace
- Workspace-specific Bazel executable configuration

## Troubleshooting

### Issue: "bazelisk: command not found"
**Solution:** Open Settings and specify the full path to your Bazel executable, e.g., `/usr/local/bin/bazel`

### Issue: Settings not persisting
**Solution:** Check browser console for localStorage errors. Clear localStorage and restart app.

### Issue: Verification fails but Bazel works in terminal
**Solution:** Ensure the path is absolute and the executable has execute permissions:
```bash
chmod +x /path/to/bazel
```

## Related Files

- `client/components/Settings.svelte` - Settings UI component
- `client/App.svelte` - App initialization and Settings modal
- `client/lib/storage.ts` - LocalStorage service
- `server/config.ts` - Server configuration with auto-detection
- `server/services/bazel.ts` - Bazel service with executable management
- `server/server.ts` - gRPC service implementation
- `proto/gazel.proto` - Protocol buffer definitions

