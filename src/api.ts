declare global {
  interface Window {
    electronAPI?: {
      selectImage: () => Promise<{path: string; data: string; name: string} | null>;
      loadImageFromPath: (filePath: string) => Promise<{success: true; path: string; data: string; name: string} | {success: false; error: string}>;
      selectMultipleImages: () => Promise<File[] | null>;
      selectFolder: () => Promise<{canceled: boolean; filePaths: string[]} | null>;
      processImage: (imageData: string, filename: string) => Promise<string>;
      saveImage: (imageData: string, defaultName?: string) => Promise<string | null>;
      saveImageToPath: (imageData: string, filePath: string) => Promise<boolean>;
      copyImageToClipboard: (imageData: string) => Promise<{success: boolean}>;
      checkModelStatus: () => Promise<any>;
      selectModel: () => Promise<{path: string; name: string} | null>;
      loadCustomModel: (modelPath: string, modelId?: string) => Promise<any>;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      checkForUpdates: () => Promise<UpdateCheckResult>;
      openExternal: (url: string) => Promise<void>;
      getBackendPort: () => Promise<number>;
      checkPythonDeps: () => Promise<{usingSystemPython: boolean; hasDependencies: boolean; pythonCommand: string}>;
      installPythonDeps: () => Promise<boolean>;
    };
  }
}

interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  releaseNotes?: string;
  error?: string;
}

let backendPort: number = 8765;

function getBackendUrl(): string {
  return `http://127.0.0.1:${backendPort}`;
}

export function setBackendPort(port: number) {
  backendPort = port;
}

export async function selectImage(): Promise<{path: string; data: string; name: string} | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.selectImage();
}

export async function loadImageFromPath(filePath: string) {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.loadImageFromPath(filePath);
}

export async function saveImage(imageData: string, defaultName?: string): Promise<string | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.saveImage(imageData, defaultName);
}

export async function copyImageToClipboard(imageData: string): Promise<void> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  await window.electronAPI.copyImageToClipboard(imageData);
}

export async function selectModel(): Promise<{path: string; name: string; size: number} | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  const result = await window.electronAPI.selectModel();
  if (!result) return null;
  return { ...result, size: 0 };
}

export async function listFixedModels(): Promise<any> {
  const response = await fetch(`${getBackendUrl()}/models/fixed`);
  return response.json();
}

export async function loadFixedModel(modelId: string): Promise<any> {
  const response = await fetch(`${getBackendUrl()}/models/load/${modelId}`, { method: 'POST' });
  return response.json();
}

export async function loadCustomModel(modelPath: string, modelId: string): Promise<any> {
  if (window.electronAPI) {
    return window.electronAPI.loadCustomModel(modelPath, modelId);
  }
  
  const response = await fetch(`${getBackendUrl()}/models/load-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: modelPath, model_id: modelId })
  });
  return response.json();
}

export async function processImageWithModel(imageBase64: string, signal?: AbortSignal): Promise<any> {
  const response = await fetch(`${getBackendUrl()}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 }),
    signal,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      resolve({ success: true, image: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function healthCheck(): Promise<any> {
  const response = await fetch(`${getBackendUrl()}/health`);
  return response.json();
}

export function windowMinimize() {
  if (window.electronAPI) {
    window.electronAPI.windowMinimize();
  }
}

export async function windowMaximize() {
  if (window.electronAPI) {
    await window.electronAPI.windowMaximize();
  }
}

export function windowClose() {
  if (window.electronAPI) {
    window.electronAPI.windowClose();
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.checkForUpdates();
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!window.electronAPI) {
    // Fallback to window.open for development
    window.open(url, '_blank');
    return;
  }
  await window.electronAPI.openExternal(url);
}

export async function getBackendPort(): Promise<number> {
  if (!window.electronAPI) {
    return 8765; // Default port
  }
  const port = await window.electronAPI.getBackendPort();
  setBackendPort(port);
  return port;
}

export async function checkPythonDeps(): Promise<{usingSystemPython: boolean; hasDependencies: boolean; pythonCommand: string}> {
  if (!window.electronAPI) {
    return { usingSystemPython: false, hasDependencies: true, pythonCommand: 'python3' };
  }
  return window.electronAPI.checkPythonDeps();
}

export async function installPythonDeps(): Promise<boolean> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.installPythonDeps();
}

export async function selectMultipleImages(): Promise<File[] | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.selectMultipleImages();
}

export async function selectFolder(): Promise<{canceled: boolean; filePaths: string[]} | null> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.selectFolder();
}

export async function saveImageToPath(imageData: string, filePath: string): Promise<boolean> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI.saveImageToPath(imageData, filePath);
}
