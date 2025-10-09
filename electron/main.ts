import fs from 'node:fs';
import os from 'node:os';

import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GazelServiceImpl } from '../server/server.ts';
import { GazelService } from '@speajus/gazel-proto';
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';

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

// Set up gRPC-over-IPC handlers
function setupGrpcHandlers() {
  if (!gazelService) {
    gazelService = new GazelServiceImpl();
  }

  // Handle unary RPC calls
  ipcMain.handle('grpc:unary:request', async (_event, request: {
    service: string;
    method: string;
    data:any;
    metadata?: { workspace?: string; executable?: string };
  }) => {


      const { service, method, data, metadata } = request;

      // Apply metadata to server config if provided
      if (metadata) {
        if (metadata.workspace) {
          const { setWorkspace } = await import('../server/config.js');
          setWorkspace(metadata.workspace);
          console.log(`[IPC] Set workspace from metadata: ${metadata.workspace}`);
        }
        if (metadata.executable) {
          const { setBazelExecutable } = await import('../server/config.js');
          const actualPath = setBazelExecutable(metadata.executable);
          console.log(`[IPC] Set bazel executable from metadata: ${actualPath}`);

          // Also update the BazelService instance
          if (gazelService && typeof (gazelService as any).setBazelExecutable === 'function') {
            (gazelService as any).setBazelExecutable(actualPath);
          }
        }
      }

      if (service !== 'GazelService') {
        throw new Error(`Unknown service: ${service}`);
      }

      // Find the method in the service definition
      const methodDef = GazelService.methods.find(m => m.localName === method);
      if (!methodDef) {
        throw new Error(`Unknown method: ${method}`);
      }

      // Convert Buffer to Uint8Array, then to the proper message type
      const uint8Data = data instanceof Buffer ? new Uint8Array(data) : data;
      const inputMessage = fromBinary(methodDef.input, uint8Data);

      // Call the service method
      const serviceMethod = gazelService[method];
      if (typeof serviceMethod !== 'function') {
        throw new Error(`Method not implemented: ${method}`);
      }
      try {
      const result = await serviceMethod.call(gazelService, inputMessage);

      // Convert result to binary for IPC transfer
      const binaryResult = toBinary(methodDef.output, result);
      return Buffer.from(binaryResult);
      } catch (error) {
        console.error('Unary handler error:', error);
        throw new ConnectError(
            `${service}#${method} ${error.message}`,
            Code.ResourceExhausted,
            new Headers(),
            [],
            error.cause
          );
      }

  });

  // Handle streaming RPC calls
  ipcMain.on('grpc:stream:start', async (event, request: {
    streamId: string;
    service: string;
    method: string;
    data: any;
    metadata?: { workspace?: string; executable?: string };
  }) => {
    try {
      const { streamId, service, method, data, metadata } = request;

      // Apply metadata to server config if provided
      if (metadata) {
        if (metadata.workspace) {
          const { setWorkspace } = await import('../server/config.js');
          setWorkspace(metadata.workspace);
          console.log(`[IPC Stream] Set workspace from metadata: ${metadata.workspace}`);
        }
        if (metadata.executable) {
          const { setBazelExecutable } = await import('../server/config.js');
          const actualPath = setBazelExecutable(metadata.executable);
          console.log(`[IPC Stream] Set bazel executable from metadata: ${actualPath}`);

          // Also update the BazelService instance
          if (gazelService && typeof (gazelService as any).setBazelExecutable === 'function') {
            (gazelService as any).setBazelExecutable(actualPath);
          }
        }
      }

      if (service !== 'GazelService') {
        event.reply(`grpc:stream:error:${streamId}`, `Unknown service: ${service}`);
        return;
      }

      // Find the method in the service definition
      const methodDef = GazelService.methods.find(m => m.localName === method);
      if (!methodDef || methodDef.kind !== 'server_streaming') {
        event.reply(`grpc:stream:error:${streamId}`, `Unknown streaming method: ${method}`);
        return;
      }

      // Convert Buffer to Uint8Array, then to the proper message type
      const uint8Data = data instanceof Buffer ? new Uint8Array(data) : data;
      const inputMessage = fromBinary(methodDef.input, uint8Data);

      // Call the service method
      const serviceMethod = (gazelService as any)[method];
      if (typeof serviceMethod !== 'function') {
        event.reply(`grpc:stream:error:${streamId}`, `Method not implemented: ${method}`);
        return;
      }

      // Get the async generator
      const generator = await serviceMethod.call(gazelService, inputMessage);

      // Stream the results
      try {
        for await (const message of generator) {
          const binaryData = toBinary(methodDef.output, message);
          const bufferData = Buffer.from(binaryData);
          event.reply(`grpc:stream:message:${streamId}`, bufferData);
        }
        event.reply(`grpc:stream:complete:${streamId}`);
      } catch (error: any) {
        event.reply(`grpc:stream:error:${streamId}`, error.message || 'Stream error');
      }
    } catch (error: any) {
      console.error('Stream handler error:', error);
      event.reply(`grpc:stream:error:${request.streamId}`, error.message || 'Unknown error');
    }
  });

  // Handle stream cancellation
  ipcMain.on('grpc:stream:cancel', (_event, streamId: string) => {
    // TODO: Implement stream cancellation if needed
    console.log(`Stream cancelled: ${streamId}`);
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

  // Use Electron Forge's Vite plugin global variables
  // These are automatically defined by the Vite plugin
  // @ts-ignore - These globals are defined by Electron Forge Vite plugin
  const MAIN_WINDOW_VITE_DEV_SERVER_URL = typeof globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined'
    ? globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL
    : undefined;
  // @ts-ignore
  const MAIN_WINDOW_VITE_NAME = typeof globalThis.MAIN_WINDOW_VITE_NAME !== 'undefined'
    ? globalThis.MAIN_WINDOW_VITE_NAME
    : 'main_window';

  logToFile('Vite plugin globals', {
    MAIN_WINDOW_VITE_DEV_SERVER_URL,
    MAIN_WINDOW_VITE_NAME,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In development, load from Vite dev server
    logToFile('Loading renderer from dev server', { url: MAIN_WINDOW_VITE_DEV_SERVER_URL });
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
