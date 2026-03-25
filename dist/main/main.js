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
let viteServer = null;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
const getAppPath = () => {
    if (electron_1.app.isPackaged) {
        return path.join(process.resourcesPath, 'app');
    }
    return path.join(__dirname, '..', '..');
};
const getDistPath = () => {
    if (electron_1.app.isPackaged) {
        return path.join(process.resourcesPath, 'app', 'dist', 'renderer');
    }
    return path.join(getAppPath(), 'dist', 'renderer');
};
const getPythonCmd = () => {
    if (electron_1.app.isPackaged) {
        const venvPath = path.join(process.resourcesPath, 'venv', 'bin', 'python3');
        if (fs.existsSync(venvPath)) {
            return venvPath;
        }
        console.log('venv not found at', venvPath, 'trying system python');
        return 'python3';
    }
    const appPath = path.join(__dirname, '..', '..');
    return process.platform === 'win32' ? 'python' : 'python3';
};
async function startViteServer() {
    return new Promise((resolve) => {
        const vitePath = electron_1.app.isPackaged
            ? path.join(process.resourcesPath, 'node_modules', 'vite', 'bin', 'vite.js')
            : path.join(getAppPath(), 'node_modules', 'vite', 'bin', 'vite.js');
        const viteProc = (0, child_process_1.spawn)('node', [vitePath, '--port', '5173'], {
            cwd: electron_1.app.isPackaged ? process.resourcesPath : getAppPath(),
            stdio: 'pipe',
            shell: true,
            env: { ...process.env, NODE_ENV: 'development' }
        });
        viteProc.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('[Vite]:', output);
            if (output.includes('Local:') && output.includes('5173')) {
                resolve(5173);
            }
        });
        viteProc.stderr.on('data', (data) => {
            console.log('[Vite]:', data.toString());
        });
        viteServer = viteProc;
    });
}
async function startPythonBackend() {
    const appPath = getAppPath();
    const pythonCmd = getPythonCmd();
    const backendPath = electron_1.app.isPackaged
        ? path.join(process.resourcesPath, 'backend', 'main.py')
        : path.join(appPath, 'backend', 'main.py');
    return new Promise((resolve) => {
        pythonProcess = (0, child_process_1.spawn)(pythonCmd, [backendPath], {
            stdio: 'pipe',
            shell: true,
            cwd: electron_1.app.isPackaged
                ? path.join(process.resourcesPath, 'backend')
                : path.join(appPath, 'backend'),
            env: { ...process.env, PYTHONPATH: process.resourcesPath }
        });
        pythonProcess.stdout.on('data', (data) => {
            console.log('[Python Backend]:', data.toString());
        });
        pythonProcess.stderr.on('data', (data) => {
            console.log('[Python Error]:', data.toString());
        });
        pythonProcess.on('close', (code) => {
            console.log(`Python backend exited with code ${code}`);
        });
        setTimeout(resolve, 3000);
    });
}
async function createWindow() {
    const appPath = getAppPath();
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: electron_1.app.isPackaged
                ? path.join(process.resourcesPath, 'app', 'dist', 'main', 'preload.js')
                : path.join(__dirname, 'preload.js'),
        },
        title: '小飞AI抠图',
        backgroundColor: '#ffffff',
        show: false,
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    if (isDev) {
        await startViteServer();
        await startPythonBackend();
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        await startPythonBackend();
        await new Promise(resolve => setTimeout(resolve, 3000));
        const distPath = getDistPath();
        mainWindow.loadFile(path.join(distPath, 'index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(async () => {
    await createWindow();
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
    if (viteServer) {
        viteServer.kill();
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
electron_1.ipcMain.handle('select-model', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'AI Models', extensions: ['onnx', 'safetensors'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        return { path: filePath, name: path.basename(filePath) };
    }
    return null;
});
electron_1.ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
});
electron_1.ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    }
    else {
        mainWindow?.maximize();
    }
});
electron_1.ipcMain.handle('window-close', () => {
    mainWindow?.close();
});
electron_1.ipcMain.handle('load-custom-model', async (_event, modelPath, modelId) => {
    try {
        const response = await fetch('http://127.0.0.1:8765/models/load-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: modelPath, model_id: modelId })
        });
        return await response.json();
    }
    catch (error) {
        console.error('Failed to load custom model:', error);
        throw error;
    }
});
