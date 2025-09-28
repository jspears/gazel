const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let bazelService = null;
let gazelService = null;

// Try to load the Bazel IPC service (for bzl-ts)
try {
  // Try services directory first, then flat structure
  try {
    const BazelIPCService = require('./services/bazel-ipc-service');
    bazelService = new BazelIPCService();
  } catch (e) {
    // Fallback to flat structure (how Electron bundler packages it)
    const BazelIPCService = require('./bazel-ipc-service');
    bazelService = new BazelIPCService();
  }
} catch (error) {
  console.warn('[Main] Could not load BazelIPCService:', error.message);
  console.warn('[Main] Running without Bazel integration');
}

// Try to load the Gazel gRPC service (for Gazel API)
try {
  // Try services directory first, then flat structure
  try {
    const GazelGrpcService = require('./services/gazel-service');
    gazelService = new GazelGrpcService();
  } catch (e) {
    // Fallback to flat structure (how Electron bundler packages it)
    const GazelGrpcService = require('./gazel-service');
    gazelService = new GazelGrpcService();
  }
} catch (error) {
  console.warn('[Main] Could not load GazelGrpcService:', error.message);
  console.warn('[Main] Running without Gazel gRPC integration');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Allow loading local resources
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'Gazel - Bazel Workspace Explorer'
    });

    // Load the bundled app directly
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Initialize Bazel IPC service if available
    if (bazelService) {
        try {
            bazelService.initialize();
            console.log('[Main] Bazel IPC service initialized');
        } catch (error) {
            console.error('[Main] Failed to initialize Bazel service:', error);
        }
    }

    // Initialize Gazel gRPC service if available
    if (gazelService) {
        try {
            gazelService.initialize();
            console.log('[Main] Gazel gRPC service initialized');
        } catch (error) {
            console.error('[Main] Failed to initialize Gazel service:', error);
        }
    }

    // Set up console logging from renderer process
    ipcMain.on('console-log', (event, level, ...args) => {
        const prefix = '[Renderer]';
        switch(level) {
            case 'log':
                console.log(prefix, ...args);
                break;
            case 'warn':
                console.warn(prefix, ...args);
                break;
            case 'error':
                console.error(prefix, ...args);
                break;
            case 'info':
                console.info(prefix, ...args);
                break;
            case 'debug':
                console.debug(prefix, ...args);
                break;
            default:
                console.log(prefix, ...args);
        }
    });
    console.log('[Main] Console logging bridge initialized');

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // TODO: Cleanup Bazel service once configured
    // if (bazelService) {
    //     bazelService.cleanup();
    //     bazelService = null;
    // }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Prevent the default behavior
    event.preventDefault();
    // Trust the certificate
    callback(true);
});
