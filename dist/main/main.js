"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
let mainWindow = null;
let pythonProcess = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
const getAppPath = () => {
    if (electron_1.app.isPackaged) {
        return path.dirname(electron_1.app.getPath('exe'));
    }
    return path.join(__dirname, '..', '..');
};
function startPythonBackend() {
    const appPath = getAppPath();
    const backendPath = path.join(appPath, 'backend', 'main.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    pythonProcess = (0, child_process_1.spawn)(pythonCmd, [backendPath], {
        stdio: 'pipe',
        shell: true,
        cwd: path.join(appPath, 'backend'),
    });
    pythonProcess.stdout.on('data', (data) => {
        console.log('[Python Backend]:', data.toString());
    });
    pythonProcess.stderr.on('data', (data) => {
        console.error('[Python Error]:', data.toString());
    });
    pythonProcess.on('close', (code) => {
        console.log(`Python backend exited with code ${code}`);
    });
}
function createWindow() {
    const appPath = getAppPath();
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        title: '小飞AI抠图',
        backgroundColor: '#ffffff',
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(appPath, 'dist', 'renderer', 'index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    if (!isDev) {
        startPythonBackend();
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.ipcMain.handle('select-image', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const imageBuffer = fs.readFileSync(filePath);
        return {
            path: filePath,
            data: imageBuffer.toString('base64'),
            name: path.basename(filePath)
        };
    }
    return null;
});
electron_1.ipcMain.handle('process-image', async (_event, imageData, filename) => {
    try {
        const response = await fetch('http://127.0.0.1:8765/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData,
                filename: filename
            }),
        });
        if (!response.ok) {
            throw new Error('Processing failed');
        }
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }
    catch (error) {
        console.error('Process error:', error);
        throw error;
    }
});
electron_1.ipcMain.handle('save-image', async (_event, imageData) => {
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
        ]
    });
    if (!result.canceled && result.filePath) {
        const buffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(result.filePath, buffer);
        return result.filePath;
    }
    return null;
});
electron_1.ipcMain.handle('check-model-status', async () => {
    try {
        const response = await fetch('http://127.0.0.1:8765/model/status');
        return await response.json();
    }
    catch (error) {
        return { loaded: false, error: 'Backend not running' };
    }
});
