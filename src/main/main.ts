import { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } from 'electron';
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
    return path.join(__dirname, '..', 'renderer');
  }
  return path.join(getAppPath(), 'dist', 'renderer');
};

const getPythonCmd = () => {
  const arch = process.arch;
  const platform = process.platform;
  const isWin = platform === 'win32';

  // venv python path differs by platform
  // Windows: venv\Scripts\python.exe
  // macOS/Linux: venv/bin/python3
  const venvPythonName = isWin ? 'python.exe' : 'python3';
  const venvBinDir = isWin ? 'Scripts' : 'bin';

  if (app.isPackaged) {
    // Try architecture-specific venv first (e.g., venv-x64, venv-arm64)
    const archSpecificVenv = path.join(
      process.resourcesPath,
      `venv-${arch}`,
      venvBinDir,
      venvPythonName
    );
    if (fs.existsSync(archSpecificVenv)) {
      console.log(`Using arch-specific venv for ${arch}:`, archSpecificVenv);
      return archSpecificVenv;
    }

    // Fall back to generic venv (for backward compatibility)
    const genericVenvPath = path.join(process.resourcesPath, 'venv', venvBinDir, venvPythonName);
    if (fs.existsSync(genericVenvPath)) {
      console.log('Using generic venv:', genericVenvPath);
      return genericVenvPath;
    }

    // Fall back to system Python
    console.log('venv not found, trying system python');
    // On Windows, try 'python' first, then 'py'
    // On macOS/Linux, try 'python3' first, then 'python'
    if (isWin) {
      // Check if python is available
      try {
        require('child_process').execSync('python --version', { stdio: 'ignore' });
        return 'python';
      } catch {
        return 'py';
      }
    }
    return 'python3';
  }

  // Development mode: use project venv
  const appPath = path.join(__dirname, '..', '..');
  const venvPath = path.join(appPath, 'venv', venvBinDir, venvPythonName);
  if (fs.existsSync(venvPath)) {
    return venvPath;
  }

  // Development fallback
  if (isWin) {
    try {
      require('child_process').execSync('python --version', { stdio: 'ignore' });
      return 'python';
    } catch {
      return 'py';
    }
  }
  return 'python3';
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

  // Check if backend file exists
  if (!fs.existsSync(backendPath)) {
    throw new Error(`Backend not found at: ${backendPath}`);
  }

  console.log('Starting Python backend...');
  console.log('Python command:', pythonCmd);
  console.log('Backend path:', backendPath);
  console.log('Architecture:', process.arch);

  return new Promise((resolve, reject) => {
    let isStarted = false;
    let errorOutput = '';

    pythonProcess = spawn(pythonCmd, [backendPath], {
      stdio: 'pipe',
      shell: true,
      cwd: app.isPackaged
        ? path.join(process.resourcesPath, 'backend')
        : path.join(appPath, 'backend'),
      env: { ...process.env, PYTHONPATH: process.resourcesPath }
    });

    pythonProcess.stdout.on('data', (data: any) => {
      const output = data.toString();
      console.log('[Python Backend]:', output);

      // Check if server is ready
      if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
        isStarted = true;
        resolve();
      }
    });

    pythonProcess.stderr.on('data', (data: any) => {
      const output = data.toString();
      console.log('[Python Error]:', output);
      errorOutput += output;

      // Check for architecture mismatch error (macOS/Linux)
      if (output.includes('bad CPU type') || output.includes('Rosetta')) {
        reject(new Error('Architecture mismatch: The embedded Python environment is not compatible with this system. Please install Python 3.9+ and required packages manually.'));
      }

      // Check for Windows-specific errors
      if (process.platform === 'win32') {
        if (output.includes('is not recognized') || output.includes('not found')) {
          reject(new Error('Python not found: Please install Python 3.9+ from https://python.org and ensure it is added to PATH.'));
        }
        if (output.includes('Permission denied')) {
          reject(new Error('Permission denied: Please run the application as Administrator or check antivirus settings.'));
        }
      }

      // Check for module import errors
      if (output.includes('ModuleNotFoundError') || output.includes('ImportError')) {
        reject(new Error('Missing Python dependencies: Please ensure all required packages are installed. Run: pip install -r requirements.txt'));
      }
    });

    pythonProcess.on('error', (error: Error) => {
      console.error('Failed to start Python backend:', error);
      reject(error);
    });

    pythonProcess.on('close', (code: number) => {
      console.log(`Python backend exited with code ${code}`);
      if (!isStarted && code !== 0) {
        reject(new Error(`Python backend exited with code ${code}. Error: ${errorOutput}`));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!isStarted) {
        if (pythonProcess) {
          pythonProcess.kill();
        }
        reject(new Error('Python backend failed to start within 10 seconds'));
      }
    }, 10000);
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
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '小飞AI抠图',
    backgroundColor: '#ffffff',
    show: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    await startViteServer();
    try {
      await startPythonBackend();
    } catch (error) {
      console.error('Failed to start Python backend in dev mode:', error);
      // In dev mode, we can continue without backend for UI development
    }
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    } else {
    try {
      await startPythonBackend();
      console.log('Python backend started successfully');
    } catch (error) {
      console.error('Failed to start Python backend:', error);

      // Build platform-specific error message
      const platform = process.platform;
      const arch = process.arch;
      let helpText = '';

      if (platform === 'win32') {
        helpText =
          `Windows 用户:\n` +
          `- 从 https://python.org 下载并安装 Python 3.9+（安装时勾选"Add to PATH"）\n` +
          `- 以管理员身份运行此应用\n` +
          `- 检查杀毒软件是否阻止了应用运行\n` +
          `- 确保已安装 Visual C++ Redistributable`;
      } else if (platform === 'darwin') {
        helpText =
          `macOS 用户:\n` +
          `- Intel Mac: 确保系统已安装 Python 3.9+（brew install python）\n` +
          `- Apple Silicon Mac: 使用 arm64 版本的应用\n` +
          `- 尝试在终端运行: /usr/bin/python3 --version`;
      } else {
        helpText =
          `Linux 用户:\n` +
          `- 安装 Python 3.9+: sudo apt install python3 python3-pip\n` +
          `- 安装依赖: pip3 install -r requirements.txt`;
      }

      // Show error dialog to user
      if (mainWindow) {
        dialog.showErrorBox(
          '后端服务启动失败',
          `无法启动 AI 处理服务。\n\n` +
          `系统信息: ${platform} ${arch}\n\n` +
          `可能的原因:\n` +
          `1. 系统架构不兼容（当前架构: ${arch}）\n` +
          `2. Python 环境未正确安装\n` +
          `3. 端口 8765 被占用\n` +
          `4. 缺少必要的依赖库\n\n` +
          `错误信息:\n${error instanceof Error ? error.message : String(error)}\n\n` +
          helpText
        );
      }
    }
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
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const imageBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Map file extension to MIME type
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    
    // Return data URL with proper MIME type prefix
    return {
      path: filePath,
      data: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
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

ipcMain.handle('save-image', async (_event: any, imageData: string, defaultName?: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultName || 'untitled.png',
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('copy-image-to-clipboard', async (_event: any, imageData: string) => {
  try {
    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const image = nativeImage.createFromBuffer(buffer);
    clipboard.writeImage(image);
    return { success: true };
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error);
    throw error;
  }
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

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
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
