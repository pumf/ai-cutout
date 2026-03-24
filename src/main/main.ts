import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let pythonProcess: any = null;
let viteServer: any = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const getAppPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '..', '..');
};

const getDistPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'dist', 'renderer');
  }
  return path.join(getAppPath(), 'dist', 'renderer');
};

const getPythonCmd = () => {
  if (app.isPackaged) {
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

async function startViteServer(): Promise<number> {
  return new Promise((resolve) => {
    const vitePath = app.isPackaged
      ? path.join(process.resourcesPath, 'node_modules', 'vite', 'bin', 'vite.js')
      : path.join(getAppPath(), 'node_modules', 'vite', 'bin', 'vite.js');
    
    const viteProc = spawn('node', [vitePath, '--port', '5173'], {
      cwd: app.isPackaged ? process.resourcesPath : getAppPath(),
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    viteProc.stdout.on('data', (data: any) => {
      const output = data.toString();
      console.log('[Vite]:', output);
      if (output.includes('Local:') && output.includes('5173')) {
        resolve(5173);
      }
    });
    
    viteProc.stderr.on('data', (data: any) => {
      console.log('[Vite]:', data.toString());
    });
    
    viteServer = viteProc;
  });
}

async function startPythonBackend(): Promise<void> {
  const appPath = getAppPath();
  const pythonCmd = getPythonCmd();
  
  const backendPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'backend', 'main.py')
    : path.join(appPath, 'backend', 'main.py');
  
  return new Promise((resolve) => {
    pythonProcess = spawn(pythonCmd, [backendPath], {
      stdio: 'pipe',
      shell: true,
      cwd: app.isPackaged 
        ? path.join(process.resourcesPath, 'backend')
        : path.join(appPath, 'backend'),
      env: { ...process.env, PYTHONPATH: process.resourcesPath }
    });
    
    pythonProcess.stdout.on('data', (data: any) => {
      console.log('[Python Backend]:', data.toString());
    });
    
    pythonProcess.stderr.on('data', (data: any) => {
      console.log('[Python Error]:', data.toString());
    });
    
    pythonProcess.on('close', (code: number) => {
      console.log(`Python backend exited with code ${code}`);
    });
    
    setTimeout(resolve, 3000);
  });
}

async function createWindow() {
  const appPath = getAppPath();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: app.isPackaged
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
  } else {
    await startPythonBackend();
    await new Promise(resolve => setTimeout(resolve, 3000));
    const distPath = getDistPath();
    mainWindow.loadFile(path.join(distPath, 'index.html'));
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();
  
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
  if (viteServer) {
    viteServer.kill();
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

ipcMain.handle('process-image', async (_event: any, imageData: string, filename: string) => {
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

ipcMain.handle('save-image', async (_event: any, imageData: string) => {
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

ipcMain.handle('select-model', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
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

ipcMain.handle('load-custom-model', async (_event: any, modelPath: string, modelId?: string) => {
  try {
    const response = await fetch('http://127.0.0.1:8765/models/load-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: modelPath, model_id: modelId })
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to load custom model:', error);
    throw error;
  }
});
