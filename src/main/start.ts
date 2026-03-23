import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const isDev = process.env.NODE_ENV === 'development';

function checkPython(): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = spawn(process.platform === 'win32' ? 'python' : 'python3', ['--version']);
    cmd.on('close', (code) => resolve(code === 0));
    cmd.on('error', () => resolve(false));
  });
}

function installDependencies(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendDir = path.join(__dirname, '..', 'backend');
    const cmd = spawn(
      process.platform === 'win32' ? 'pip' : 'pip3',
      ['install', '-r', 'requirements.txt'],
      { cwd: backendDir, shell: true }
    );
    
    cmd.stdout.on('data', (data) => console.log(data.toString()));
    cmd.stderr.on('data', (data) => console.error(data.toString()));
    cmd.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pip exited with code ${code}`));
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
  } catch (e) {
    console.error('依赖安装失败:', e);
    process.exit(1);
  }
  
  console.log('启动后端服务...');
  const backendPath = path.join(__dirname, '..', 'backend', 'main.py');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  const backendProcess = spawn(pythonCmd, [backendPath], {
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
} else {
  require('./main');
}
