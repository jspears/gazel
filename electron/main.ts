import fs from 'node:fs';
import os from 'node:os';

import { app, BrowserWindow, ipcMain, protocol, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GazelServiceImpl } from '../server/server.js';
import { GazelService } from '@speajus/gazel-proto';
import { fromBinary, toBinary } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { setBazelExecutable, setWorkspace } from '../server/config.js';

// Declare Electron Forge Vite plugin magic variables
// These are injected at build time by the Vite plugin
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDirectory = () => {
  try {
    const temp = os.tmpdir?.();
    if (temp) {
      return path.join(temp, 'gazel');
    }
  } catch (error) {
    console.error('Failed to resolve tmp directory for logging', error);
  }

  try {
    const home = os.homedir?.();
    if (home) {
      return path.join(home, 'Library', 'Logs', 'gazel');
    }
  } catch (error) {
    console.error('Failed to resolve home directory for logging', error);
  }

  return process.cwd();
};

const logFilePath = path.join(logDirectory(), 'gazel-electron-main.log');

function serializeLogValue(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function logToFile(message: string, ...args: unknown[]) {
  const line = [new Date().toISOString(), message, ...args.map(serializeLogValue)].join(' ');
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.appendFileSync(logFilePath, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write log entry', error);
  }
  console.log(`[Main] ${message}`, ...args);
}

logToFile('Main process module loaded', { argv: process.argv, cwd: process.cwd() });

process.on('uncaughtException', (error) => {
  logToFile('uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  logToFile('unhandledRejection', reason);
});
const protocolLogLimit = 20;
let protocolRequestCount = 0;


let mainWindow: BrowserWindow | null = null;
let gazelService: GazelServiceImpl | null = null;

// Set up console logging from renderer to main process
function setupLogging() {
  logToFile('Initializing renderer log bridge');
  ipcMain.on('console:log', (_event, level: string, ...args: unknown[]) => {
    logToFile('Renderer console event', { level, args });
    console.log(`[Renderer:${level}]`, ...args);
  });
}

// Set up dialog handlers
function setupDialogHandlers() {
  logToFile('Setting up dialog handlers');

  // Handle workspace file selection
  ipcMain.handle('dialog:selectWorkspaceFile', async () => {
    logToFile('dialog:selectWorkspaceFile handler invoked');

    if (!mainWindow) {
      logToFile('No main window available for dialog');
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Workspace File',
      properties: ['openFile'],
      filters: [
        { name: 'Bazel Workspace Files', extensions: ['bazel'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      message: 'Select a BUILD.bazel, MODULE.bazel, or WORKSPACE.bazel file'
    });

    if (result.canceled || result.filePaths.length === 0) {
      logToFile('File selection cancelled');
      return null;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);

    // Validate file name
    const validFileNames = ['BUILD.bazel', 'BUILD', 'MODULE.bazel', 'MODULE', 'WORKSPACE.bazel', 'WORKSPACE'];
    if (!validFileNames.includes(fileName)) {
      logToFile('Invalid workspace file selected', { fileName, filePath });
      return null;
    }

    // Return the directory path
    const dirPath = path.dirname(filePath);
    logToFile('Workspace file selected', { fileName, dirPath });
    return dirPath;
  });

  logToFile('Dialog handlers registered');
}

// Set up gRPC-over-IPC handlers
function setupGrpcHandlers() {
  if (!gazelService) {
    gazelService = new GazelServiceImpl();
  }

  // Handle unary RPC calls
  ipcMain.handle('grpc:unary', async (_event, request: {
    service: string;
    method: string;
    message: unknown;
   }) => {
      const { service, method, message } = request;

      logToFile('[IPC Unary] Received request', { service, method, expectedService: 'gazel.api.v1.GazelService' });

      if (service !== 'gazel.api.v1.GazelService') {
        throw new Error(`Unknown service: ${service} (expected: gazel.api.v1.GazelService)`);
      }

      // Find the method in the service definition
      const methodDef = GazelService.methods.find(m => m.localName === method);
      if (!methodDef) {
        throw new Error(`Unknown method: ${method}`);
      }

      // Call the service method
      const methodName = methodDef.localName;
      const serviceMethod = gazelService[methodName];
      if (typeof serviceMethod !== 'function') {
        throw new Error(`Method not implemented: ${methodName}`);
      }

      try {
        const result = await serviceMethod.call(gazelService, message);
        return result;
      } catch (error) {
        console.error('Unary handler error:', error);
        throw error;
      }
  });

  // Track active streams for cancellation
  const activeStreams = new Map<string, { cancel: () => void }>();

  // Handle streaming RPC calls
  ipcMain.handle('grpc:stream:start', async (event, request: {
    streamId: string;
    service: string;
    method: string;
    message: unknown;
  }) => {
    const { streamId, service, method, message } = request;
    const dataChannel = `grpc:stream:${streamId}:data`;
    const completeChannel = `grpc:stream:${streamId}:complete`;
    const errorChannel = `grpc:stream:${streamId}:error`;

    logToFile('[IPC Stream] Starting stream', { streamId, method });

    try {
      logToFile('[IPC Stream] Received request', { service, method, expectedService: 'gazel.api.v1.GazelService' });

      if (service !== 'gazel.api.v1.GazelService') {
        throw new Error(`Unknown service: ${service} (expected: gazel.api.v1.GazelService)`);
      }

      // Find the method in the service definition
      const methodDef = GazelService.methods.find(m => m.localName === method);
      if (!methodDef || methodDef.methodKind !== 'server_streaming') {
        throw new Error(`Unknown streaming method: ${method}`);
      }

      // Call the service method directly with the input
      const methodName = methodDef.localName;
      const serviceMethod = gazelService[methodName];
      if (typeof serviceMethod !== 'function') {
        throw new Error(`Method not implemented: ${methodName}`);
      }

      let cancelled = false;
      activeStreams.set(streamId, {
        cancel: () => {
          cancelled = true;
          logToFile('[IPC Stream] Stream cancelled', { streamId, method });
        }
      });

      // Get the async generator and iterate through it in the background
      (async () => {
        try {
          const generator = serviceMethod.call(gazelService, message);

          for await (const msg of generator) {
            if (cancelled) {
              logToFile('[IPC Stream] Breaking due to cancellation', { streamId });
              break;
            }

            // Serialize the message to binary for IPC transfer
            // This avoids circular reference errors
            const binaryMsg = toBinary(methodDef.output, msg);

            // Send each message to the renderer
            event.sender.send(dataChannel, binaryMsg);
          }

          // Send completion signal
          if (!cancelled) {
            event.sender.send(completeChannel);
            logToFile('[IPC Stream] Stream completed', { streamId, method });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logToFile('[IPC Stream] Stream error', { streamId, method, error: errorMessage });
          event.sender.send(errorChannel, errorMessage);
        } finally {
          activeStreams.delete(streamId);
        }
      })();

      // Return immediately
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logToFile('[IPC Stream] Failed to start stream', { streamId, method, error: errorMessage });
      throw error;
    }
  });

  // Handle stream cancellation
  ipcMain.on('grpc:stream:cancel', (_event, streamId: string) => {
    const stream = activeStreams.get(streamId);
    if (stream) {
      stream.cancel();
      activeStreams.delete(streamId);
    }
  });
}

async function createWindow() {
  logToFile('createWindow invoked');

  // In Electron Forge, preload scripts are in .vite/build
  // __dirname is .vite/build when running in dev mode
  const preloadPath = path.join(__dirname, 'preload.cjs');
  const iconPath = path.join(__dirname, '../../assets/icon.png');

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for some Electron APIs
      // Allow loading local resources (required for packaged apps)
      webSecurity: false, // Disable web security to allow file:// protocol access
    },
    icon: iconPath,
    title: 'Gazel - Bazel Explorer',
  });

  logToFile('BrowserWindow created', { preloadPath, iconPath });

  if (!mainWindow) {
    logToFile('BrowserWindow creation failed');
    return;
  }

  mainWindow.on('ready-to-show', () => {
    logToFile('Main window ready-to-show');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logToFile('Renderer finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logToFile('Renderer failed to load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  });

  // Log all console messages from renderer
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelMap = ['log', 'warn', 'error'];
    logToFile(`Renderer console [${levelMap[level] || level}]`, {
      message,
      source: `${sourceId}:${line}`,
    });
  });

  // Log renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logToFile('Renderer process gone', details);
  });

  // Use Electron Forge's Vite plugin magic variables
  // These are declared at the top of the file and injected at build time
  logToFile('Vite plugin magic variables', {
    MAIN_WINDOW_VITE_DEV_SERVER_URL,
    MAIN_WINDOW_VITE_NAME,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In development, load from Vite dev server
    logToFile('Loading renderer from dev server', { url: MAIN_WINDOW_VITE_DEV_SERVER_URL });
    // Clear cache in development to avoid stale module issues
    await mainWindow.webContents.session.clearCache();
    logToFile('Cleared browser cache');
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL).catch(error => {
      logToFile('Failed to load dev server URL', error);
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load from built files using Electron Forge's expected path
    const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    const rendererExists = fs.existsSync(rendererPath);
    logToFile('Loading renderer from file', {
      rendererPath,
      rendererExists,
      __dirname,
      MAIN_WINDOW_VITE_NAME,
    });
    if (!rendererExists) {
      logToFile('Renderer entry file missing', { rendererPath });
      // List what files are actually there
      const rendererDir = path.join(__dirname, '../renderer');
      if (fs.existsSync(rendererDir)) {
        const files = fs.readdirSync(rendererDir);
        logToFile('Files in renderer directory', { files });
      } else {
        logToFile('Renderer directory does not exist', { rendererDir });
      }
    }
    mainWindow.loadFile(rendererPath).catch(error => {
      logToFile('Failed to load renderer file', error);
    });
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    logToFile('Main window closed');
    mainWindow = null;
  });

  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logToFile('Window open handler invoked', { url });
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// App event handlers
app.whenReady().then(() => {
  logToFile('app.whenReady resolved', {
    argv: process.argv,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  });

  // Set up custom protocol for serving local files if needed
  logToFile('Registering gazel file protocol');
  protocol.registerFileProtocol('gazel', (request, callback) => {
    protocolRequestCount += 1;
    const strippedUrl = request.url.replace(/^gazel:\/\//, '');
    const targetPath = path.normalize(path.join(__dirname, strippedUrl));
    if (protocolRequestCount <= protocolLogLimit) {
      logToFile('gazel protocol request', {
        count: protocolRequestCount,
        url: request.url,
        strippedUrl,
        targetPath,
      });
    }
    callback({ path: targetPath });
  });
  logToFile('gazel file protocol registered');

  setupLogging();
  setupDialogHandlers();
  setupGrpcHandlers();
  createWindow();

  app.on('activate', () => {
    logToFile('App activate event');
    if (BrowserWindow.getAllWindows().length === 0) {
      logToFile('No existing windows, creating new window from activate handler');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logToFile('window-all-closed event');
  if (process.platform !== 'darwin') {
    logToFile('Quitting app due to all windows closed on non-darwin platform');
    app.quit();
  }
});

app.on('render-process-gone', (_event, webContents, details) => {
  logToFile('render-process-gone event', {
    reason: details.reason,
    exitCode: details.exitCode,
    url: webContents.getURL(),
  });
});

// Handle certificate errors
app.on('certificate-error', (event, _webContents, url, error, _certificate, callback) => {
  logToFile('certificate-error event', { url, error });
  // Prevent default behavior
  event.preventDefault();
  // Accept the certificate
  callback(true);
});

// Export for testing
export { setupGrpcHandlers, setupLogging };
