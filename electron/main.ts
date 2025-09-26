import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

// Declare the Vite dev server URL and name variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort = 3002;

// Function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// Function to start the Express server
async function startServer(): Promise<void> {
  serverPort = await findAvailablePort(3002);
  
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server', 'index.js');
    
    // Check if we're in development or production
    const isDev = process.env.NODE_ENV !== 'production';
    
    if (isDev) {
      // In development, use tsx to run TypeScript directly
      serverProcess = spawn('npx', ['tsx', serverPath.replace('.js', '.ts')], {
        env: {
          ...process.env,
          PORT: serverPort.toString(),
          NODE_ENV: 'development',
          ELECTRON_APP: 'true'
        },
        stdio: 'pipe'
      });
    } else {
      // In production, run the compiled JavaScript
      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          PORT: serverPort.toString(),
          NODE_ENV: 'production',
          ELECTRON_APP: 'true'
        },
        stdio: 'pipe'
      });
    }

    serverProcess.stdout?.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes('Server running')) {
        resolve();
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    // Give the server some time to start
    setTimeout(() => resolve(), 3000);
  });
}

// Function to stop the server
function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// Function to create the main window
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Load the app using Electron Forge's Vite plugin
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // In development, load from Vite dev server
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Function to create the application menu
function createMenu(): void {
  const template: any[] = [
    {
      label: 'Gazel',
      submenu: [
        {
          label: 'About Gazel',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Gazel',
              message: 'Gazel',
              detail: 'A modern UI for exploring and understanding Bazel workspaces.\n\nVersion: 1.0.0',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // TODO: Implement preferences window
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/jspears/gazel');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/jspears/gazel/issues');
          }
        }
      ]
    }
  ];

  // On macOS, add empty object to get the app name in the menu
  if (process.platform === 'darwin') {
    template[0].label = app.getName();
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for workspace selection
ipcMain.handle('select-workspace', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Bazel Workspace',
    message: 'Choose a directory containing a MODULE.bazel or WORKSPACE file'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const workspacePath = result.filePaths[0];
    // Validate it's a Bazel workspace
    const hasModule = fs.existsSync(path.join(workspacePath, 'MODULE.bazel'));
    const hasWorkspace = fs.existsSync(path.join(workspacePath, 'WORKSPACE')) || 
                         fs.existsSync(path.join(workspacePath, 'WORKSPACE.bazel'));
    
    if (hasModule || hasWorkspace) {
      return { success: true, path: workspacePath };
    } else {
      return { success: false, error: 'Selected directory is not a valid Bazel workspace' };
    }
  }
  
  return { success: false, error: 'No directory selected' };
});

// App event handlers
app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
    createMenu();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  stopServer();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
