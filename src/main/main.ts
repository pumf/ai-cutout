import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let pythonProcess: any = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function startPythonBackend() {
  const backendPath = path.join(__dirname, '..', '..', 'backend', 'main.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  pythonProcess = spawn(pythonCmd, [backendPath], {
    stdio: 'pipe',
    shell: true,
  });
  
  pythonProcess.stdout.on('data', (data: any) => {
    console.log('[Python Backend]:', data.toString());
  });
  
  pythonProcess.stderr.on('data', (data: any) => {
    console.error('[Python Error]:', data.toString());
  });
  
  pythonProcess.on('close', (code: number) => {
    console.log(`Python backend exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  if (!isDev) {
    startPythonBackend();
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
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

ipcMain.handle('process-image', async (_, imageData: string, filename: string) => {
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
  } catch (error) {
    console.error('Process error:', error);
    throw error;
  }
});

ipcMain.handle('save-image', async (_, imageData: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
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

ipcMain.handle('check-model-status', async () => {
  try {
    const response = await fetch('http://127.0.0.1:8765/model/status');
    return await response.json();
  } catch (error) {
    return { loaded: false, error: 'Backend not running' };
  }
});
