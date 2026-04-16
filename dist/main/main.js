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
// Setup logging to file
const logDir = path.join(electron_1.app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'main.log');
// Redirect console.log to file in production
if (electron_1.app.isPackaged) {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        logStream.write(`[${new Date().toISOString()}] LOG: ${message}\n`);
        originalLog.apply(console, args);
    };
    console.error = (...args) => {
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        logStream.write(`[${new Date().toISOString()}] ERROR: ${message}\n`);
        originalError.apply(console, args);
    };
    console.log('Logging to:', logFile);
}
// Check if Python dependencies are installed
const checkPythonDependencies = (pythonCmd) => {
    try {
        (0, child_process_1.execSync)(`${pythonCmd} -c "import torch, torchvision, numpy, pillow, onnxruntime, fastapi, uvicorn"`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
};
// Check if we're using embedded venv (not system Python)
const isEmbeddedVenv = (pythonCmd) => {
    return electron_1.app.isPackaged && pythonCmd.includes('venv');
};
// Install Python dependencies automatically (only for system Python, not embedded venv)
const installPythonDependencies = async (pythonCmd) => {
    // If using embedded venv, don't show dialog - dependencies should be pre-installed
    if (isEmbeddedVenv(pythonCmd)) {
        console.log('Using embedded venv, skipping dependency installation dialog');
        // Try to install silently in background
        return new Promise((resolve) => {
            const deps = 'torch torchvision numpy pillow onnxruntime fastapi uvicorn python-multipart python-json-logger';
            const installProcess = (0, child_process_1.spawn)(pythonCmd, ['-m', 'pip', 'install', ...deps.split(' ')], {
                stdio: 'pipe',
                shell: true,
            });
            let output = '';
            installProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log('[pip install]:', data.toString());
            });
            installProcess.stderr.on('data', (data) => {
                output += data.toString();
                console.error('[pip install error]:', data.toString());
            });
            installProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('Dependencies installed successfully');
                    resolve(true);
                }
                else {
                    console.error('Failed to install dependencies:', output);
                    // Don't show error for embedded venv - just log it
                    resolve(false);
                }
            });
        });
    }
    // For system Python, show dialog
    return new Promise((resolve) => {
        const deps = 'torch torchvision numpy pillow onnxruntime fastapi uvicorn python-multipart python-json-logger';
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '安装 Python 依赖',
            message: '首次启动需要安装 Python 依赖',
            detail: `检测到缺少必要的 Python 依赖。点击"安装"按钮自动安装，或点击"取消"手动安装。\n\n需要的依赖：${deps}`,
            buttons: ['安装', '取消'],
            defaultId: 0,
        }).then(({ response }) => {
            if (response === 0) {
                // User clicked Install
                electron_1.dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '正在安装',
                    message: '正在安装依赖，请稍候...',
                    detail: '这可能需要几分钟时间，取决于网络速度。',
                });
                const installProcess = (0, child_process_1.spawn)(pythonCmd, ['-m', 'pip', 'install', ...deps.split(' ')], {
                    stdio: 'pipe',
                    shell: true,
                });
                let output = '';
                installProcess.stdout.on('data', (data) => {
                    output += data.toString();
                    console.log('[pip install]:', data.toString());
                });
                installProcess.stderr.on('data', (data) => {
                    output += data.toString();
                    console.error('[pip install error]:', data.toString());
                });
                installProcess.on('close', (code) => {
                    if (code === 0) {
                        electron_1.dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: '安装完成',
                            message: '依赖安装成功！',
                            detail: '请重启应用以使用完整功能。',
                            buttons: ['重启应用'],
                        }).then(() => {
                            electron_1.app.relaunch();
                            electron_1.app.exit(0);
                        });
                        resolve(true);
                    }
                    else {
                        electron_1.dialog.showErrorBox('安装失败', `依赖安装失败（退出码：${code}）。\n\n请手动在终端执行：\n${pythonCmd} -m pip install ${deps}\n\n错误输出：\n${output.slice(-500)}`);
                        resolve(false);
                    }
                });
            }
            else {
                resolve(false);
            }
        });
    });
};
const getAppPath = () => {
    if (electron_1.app.isPackaged) {
        return path.join(process.resourcesPath, 'app');
    }
    return path.join(__dirname, '..', '..');
};
const getDistPath = () => {
    if (electron_1.app.isPackaged) {
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
    if (electron_1.app.isPackaged) {
        // Use universal venv (venv-x64 repackaged as venv)
        // venv-x64 is a universal binary supporting both x86_64 and arm64
        const venvPath = path.join(process.resourcesPath, 'venv', venvBinDir, venvPythonName);
        if (fs.existsSync(venvPath)) {
            console.log(`Using venv:`, venvPath);
            return venvPath;
        }
        // Fall back to system Python
        console.log('Using system Python (embedded venv not compatible)');
        // On Windows, try 'python' first, then 'py'
        // On macOS/Linux, try 'python3' first, then 'python'
        if (isWin) {
            // Check if python is available
            try {
                require('child_process').execSync('python --version', { stdio: 'ignore' });
                return 'python';
            }
            catch {
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
        }
        catch {
            return 'py';
        }
    }
    return 'python3';
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
let backendPort = 8765;
async function startPythonBackend() {
    const appPath = getAppPath();
    const pythonCmd = getPythonCmd();
    const backendPath = electron_1.app.isPackaged
        ? path.join(process.resourcesPath, 'backend', 'main.py')
        : path.join(appPath, 'backend', 'main.py');
    // Check if backend file exists
    if (!fs.existsSync(backendPath)) {
        throw new Error(`Backend not found at: ${backendPath}`);
    }
    // Check if Python exists
    if (!fs.existsSync(pythonCmd) && !pythonCmd.includes('python3')) {
        throw new Error(`Python not found at: ${pythonCmd}`);
    }
    console.log('Starting Python backend...');
    console.log('Python command:', pythonCmd);
    console.log('Backend path:', backendPath);
    console.log('Architecture:', process.arch);
    console.log('Resources path:', process.resourcesPath);
    // Verify Python works
    try {
        const testResult = require('child_process').execSync(`"${pythonCmd}" --version`, { encoding: 'utf8' });
        console.log('Python version:', testResult.trim());
    }
    catch (e) {
        console.error('Python test failed:', e);
        throw new Error(`Python test failed: ${pythonCmd}`);
    }
    // Delete old port file if exists
    const portFile = electron_1.app.isPackaged
        ? path.join(process.resourcesPath, 'backend', '.backend_port')
        : path.join(appPath, 'backend', '.backend_port');
    if (fs.existsSync(portFile)) {
        fs.unlinkSync(portFile);
    }
    return new Promise((resolve, reject) => {
        let isStarted = false;
        let errorOutput = '';
        const startTime = Date.now();
        const timeoutMs = 30000; // 30 seconds timeout
        // Use array format for spawn to avoid shell escaping issues
        const spawnArgs = [backendPath];
        console.log('Spawning Python:', pythonCmd, spawnArgs.join(' '));
        pythonProcess = (0, child_process_1.spawn)(pythonCmd, spawnArgs, {
            stdio: 'pipe',
            shell: false, // Don't use shell to avoid escaping issues
            cwd: electron_1.app.isPackaged
                ? path.join(process.resourcesPath, 'backend')
                : path.join(appPath, 'backend'),
            env: {
                ...process.env,
                PYTHONPATH: process.resourcesPath,
                PYTHONUNBUFFERED: '1' // Ensure Python output is not buffered
            }
        });
        // Function to check if server is ready
        const checkServerReady = (output) => {
            if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
                if (!isStarted) {
                    isStarted = true;
                    console.log('Python backend is ready!');
                    // Try to read the port file
                    setTimeout(() => {
                        if (fs.existsSync(portFile)) {
                            const port = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
                            if (!isNaN(port)) {
                                backendPort = port;
                                console.log(`Backend started on port ${backendPort}`);
                            }
                        }
                        resolve();
                    }, 500);
                }
            }
        };
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('[Python Backend]:', output);
            checkServerReady(output);
        });
        pythonProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('[Python Error]:', output);
            errorOutput += output;
            // Also check stderr for server ready messages (some Python logs go to stderr)
            checkServerReady(output);
            // Check for architecture mismatch error (macOS/Linux)
            if (output.includes('bad CPU type') || output.includes('Rosetta')) {
                reject(new Error('Architecture mismatch: The embedded Python environment is not compatible with this system. Please install Python 3.9+ and required packages manually.'));
            }
            // Check for module import errors (missing dependencies)
            if (output.includes('ModuleNotFoundError') || output.includes('ImportError')) {
                reject(new Error('Missing Python dependencies: Please ensure all required packages are installed. Run: pip install torch torchvision numpy pillow onnxruntime fastapi uvicorn python-multipart python-json-logger'));
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
        pythonProcess.on('error', (error) => {
            console.error('Failed to start Python backend:', error);
            reject(error);
        });
        pythonProcess.on('close', (code) => {
            console.log(`Python backend exited with code ${code}`);
            if (!isStarted && code !== 0) {
                console.error('Backend exit error output:', errorOutput);
                reject(new Error(`Python backend exited with code ${code}. Error: ${errorOutput || 'Unknown error'}`));
            }
        });
        // Timeout check with better logging
        const timeoutId = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (!isStarted && elapsed > timeoutMs) {
                clearInterval(timeoutId);
                if (pythonProcess) {
                    pythonProcess.kill();
                }
                console.error('Backend startup timeout. Error output:', errorOutput);
                reject(new Error(`Python backend failed to start within ${timeoutMs}ms. Error: ${errorOutput || 'No error output captured'}`));
            }
            else if (!isStarted && elapsed > 10000) {
                // Log progress after 10 seconds
                console.log(`Waiting for backend... ${elapsed}ms elapsed`);
            }
        }, 1000);
    });
}
async function createWindow() {
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
        }
        catch (error) {
            console.error('Failed to start Python backend in dev mode:', error);
            // In dev mode, we can continue without backend for UI development
        }
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        const pythonCmd = getPythonCmd();
        const usingEmbeddedVenv = isEmbeddedVenv(pythonCmd);
        const isUsingSystemPython = !usingEmbeddedVenv && (pythonCmd === 'python3' || pythonCmd === 'python');
        console.log('Python command:', pythonCmd);
        console.log('Using embedded venv:', usingEmbeddedVenv);
        console.log('Using system Python:', isUsingSystemPython);
        // For embedded venv, always try to start backend directly (dependencies should be pre-installed)
        if (usingEmbeddedVenv) {
            console.log('Using embedded venv, starting backend directly...');
            try {
                await startPythonBackend();
                console.log('Python backend started successfully with embedded venv');
            }
            catch (error) {
                console.error('Failed to start Python backend with embedded venv:', error);
                // Show error to user for Intel Mac
                if (process.arch === 'x64') {
                    electron_1.dialog.showErrorBox('后端启动失败', `无法启动 Python 后端:\n${error}\n\n请尝试以下解决方案:\n1. 重新安装应用\n2. 或者安装系统 Python 3.9+ 并手动安装依赖: pip install torch torchvision numpy pillow onnxruntime fastapi uvicorn python-multipart python-json-logger`);
                }
            }
            const distPath = getDistPath();
            mainWindow.loadFile(path.join(distPath, 'index.html'));
        }
        // For system Python, check dependencies
        else if (isUsingSystemPython && !checkPythonDependencies(pythonCmd)) {
            console.log('Python dependencies not found, prompting user to install...');
            // Load the UI first
            const distPath = getDistPath();
            mainWindow.loadFile(path.join(distPath, 'index.html'));
            // Wait for window to show before showing dialog
            mainWindow.once('ready-to-show', async () => {
                mainWindow?.show();
                // Show install dialog
                const installed = await installPythonDependencies(pythonCmd);
                if (!installed) {
                    // User cancelled, show warning but continue
                    electron_1.dialog.showMessageBox(mainWindow, {
                        type: 'warning',
                        title: '缺少依赖',
                        message: 'Python 依赖未安装',
                        detail: '部分功能可能无法使用。您可以在帮助页面中点击"检查更新"按钮重新安装依赖。',
                        buttons: ['知道了'],
                    });
                }
            });
        }
        else {
            // Dependencies are installed, start backend normally
            try {
                await startPythonBackend();
                console.log('Python backend started successfully');
            }
            catch (error) {
                console.error('Failed to start Python backend:', error);
            }
            const distPath = getDistPath();
            mainWindow.loadFile(path.join(distPath, 'index.html'));
        }
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
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const imageBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        // Map file extension to MIME type
        const mimeTypes = {
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
electron_1.ipcMain.handle('select-multiple-images', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        // Return File objects that can be used in renderer process
        const files = result.filePaths.map(filePath => {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif'
            };
            const mimeType = mimeTypes[ext] || 'image/png';
            // Create a File-like object
            return {
                path: filePath,
                name: path.basename(filePath),
                type: mimeType,
                size: buffer.length,
                data: buffer.toString('base64')
            };
        });
        return files;
    }
    return null;
});
electron_1.ipcMain.handle('select-folder', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result;
});
electron_1.ipcMain.handle('save-image-to-path', async (_event, imageData, filePath) => {
    try {
        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        return true;
    }
    catch (error) {
        console.error('Save image to path error:', error);
        return false;
    }
});
electron_1.ipcMain.handle('process-image', async (_event, imageData, filename) => {
    try {
        const response = await fetch(`http://127.0.0.1:${backendPort}/process`, {
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
electron_1.ipcMain.handle('save-image', async (_event, imageData, defaultName) => {
    // 根据文件扩展名确定 filters
    const ext = defaultName ? path.extname(defaultName).toLowerCase() : '.png';
    let filters;
    if (ext === '.gif') {
        filters = [
            { name: 'GIF Image', extensions: ['gif'] },
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
        ];
    }
    else {
        filters = [
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
            { name: 'GIF Image', extensions: ['gif'] }
        ];
    }
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName || 'untitled.png',
        filters
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
electron_1.ipcMain.handle('copy-image-to-clipboard', async (_event, imageData) => {
    try {
        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const image = electron_1.nativeImage.createFromBuffer(buffer);
        electron_1.clipboard.writeImage(image);
        return { success: true };
    }
    catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        throw error;
    }
});
electron_1.ipcMain.handle('check-model-status', async () => {
    try {
        const response = await fetch(`http://127.0.0.1:${backendPort}/model/status`);
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
        const response = await fetch(`http://127.0.0.1:${backendPort}/models/load-custom`, {
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
// Get backend port
electron_1.ipcMain.handle('get-backend-port', () => {
    return backendPort;
});
// Check Python dependencies status
electron_1.ipcMain.handle('check-python-deps', async () => {
    const pythonCmd = getPythonCmd();
    const usingEmbeddedVenv = isEmbeddedVenv(pythonCmd);
    const isUsingSystemPython = !usingEmbeddedVenv && (pythonCmd === 'python3' || pythonCmd === 'python');
    const hasDeps = checkPythonDependencies(pythonCmd);
    return {
        usingSystemPython: isUsingSystemPython,
        usingEmbeddedVenv: usingEmbeddedVenv,
        hasDependencies: hasDeps,
        pythonCommand: pythonCmd,
    };
});
// Install Python dependencies from renderer
electron_1.ipcMain.handle('install-python-deps', async () => {
    const pythonCmd = getPythonCmd();
    return await installPythonDependencies(pythonCmd);
});
// Check for updates from GitHub releases
electron_1.ipcMain.handle('check-for-updates', async () => {
    try {
        const response = await fetch('https://api.github.com/repos/pumf/ai-cutout/releases/latest');
        if (!response.ok) {
            throw new Error('Failed to fetch latest release');
        }
        const data = await response.json();
        const latestVersion = data.tag_name.replace(/^v/, '');
        const currentVersion = electron_1.app.getVersion();
        console.log('Current version:', currentVersion);
        console.log('Latest version:', latestVersion);
        // Compare versions
        const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
        return {
            hasUpdate,
            currentVersion,
            latestVersion,
            releaseUrl: data.html_url,
            releaseNotes: data.body
        };
    }
    catch (error) {
        console.error('Failed to check for updates:', error);
        return {
            hasUpdate: false,
            currentVersion: electron_1.app.getVersion(),
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
});
// Open external URL
electron_1.ipcMain.handle('open-external', async (_event, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
});
// Version comparison helper
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        if (part1 > part2)
            return 1;
        if (part1 < part2)
            return -1;
    }
    return 0;
}
