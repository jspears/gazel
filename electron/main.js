const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;
// TODO: Add bazel service once build is configured
// const BazelIPCService = require('./services/bazel-ipc-service');
// let bazelService = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Allow loading local resources
            // TODO: Add preload script once configured
            // preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'Gazel - Bazel Workspace Explorer'
    });

    // Load the index.html file
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
    // TODO: Initialize Bazel IPC service once build is configured
    // bazelService = new BazelIPCService();
    // bazelService.initialize();

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
