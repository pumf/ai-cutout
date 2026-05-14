import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectImage: () => ipcRenderer.invoke('select-image'),
  selectMultipleImages: () => ipcRenderer.invoke('select-multiple-images'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  processImage: (imageData: string, filename: string) =>
    ipcRenderer.invoke('process-image', imageData, filename),
  saveImage: (imageData: string, defaultName?: string) => ipcRenderer.invoke('save-image', imageData, defaultName),
  saveImageToPath: (imageData: string, filePath: string) => ipcRenderer.invoke('save-image-to-path', imageData, filePath),
  copyImageToClipboard: (imageData: string) => ipcRenderer.invoke('copy-image-to-clipboard', imageData),
  checkModelStatus: () => ipcRenderer.invoke('check-model-status'),
  selectModel: () => ipcRenderer.invoke('select-model'),
  loadCustomModel: (modelPath: string, modelId?: string) => ipcRenderer.invoke('load-custom-model', modelPath, modelId),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openFolder: (dir: string) => ipcRenderer.invoke('open-folder', dir),
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  checkPythonDeps: () => ipcRenderer.invoke('check-python-deps'),
  installPythonDeps: () => ipcRenderer.invoke('install-python-deps'),
});
