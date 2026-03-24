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
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const isDev = process.env.NODE_ENV === 'development';
function checkPython() {
    return new Promise((resolve) => {
        const cmd = (0, child_process_1.spawn)(process.platform === 'win32' ? 'python' : 'python3', ['--version']);
        cmd.on('close', (code) => resolve(code === 0));
        cmd.on('error', () => resolve(false));
    });
}
function installDependencies() {
    return new Promise((resolve, reject) => {
        const backendDir = path.join(__dirname, '..', 'backend');
        const cmd = (0, child_process_1.spawn)(process.platform === 'win32' ? 'pip' : 'pip3', ['install', '-r', 'requirements.txt'], { cwd: backendDir, shell: true });
        cmd.stdout.on('data', (data) => console.log(data.toString()));
        cmd.stderr.on('data', (data) => console.error(data.toString()));
        cmd.on('close', (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`pip exited with code ${code}`));
        });
    });
}
async function main() {
    console.log('检查 Python 环境...');
    const hasPython = await checkPython();
    if (!hasPython) {
        console.error('请先安装 Python 3.8+');
        process.exit(1);
    }
    console.log('安装 Python 依赖...');
    try {
        await installDependencies();
        console.log('依赖安装完成');
    }
    catch (e) {
        console.error('依赖安装失败:', e);
        process.exit(1);
    }
    console.log('启动后端服务...');
    const backendPath = path.join(__dirname, '..', 'backend', 'main.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const backendProcess = (0, child_process_1.spawn)(pythonCmd, [backendPath], {
        stdio: 'pipe',
        shell: true,
    });
    backendProcess.stdout.on('data', (data) => {
        console.log('[Backend]:', data.toString());
    });
    backendProcess.stderr.on('data', (data) => {
        console.error('[Backend Error]:', data.toString());
    });
    console.log('启动 Electron 应用...');
    const { app } = require('electron');
    app.whenReady().then(() => {
        require('./main');
    });
}
if (!isDev) {
    main();
}
else {
    require('./main');
}
