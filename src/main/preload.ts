import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectImage: () => ipcRenderer.invoke('select-image'),
  processImage: (imageData: string, filename: string) =>
    ipcRenderer.invoke('process-image', imageData, filename),
  saveImage: (imageData: string, defaultName?: string) => ipcRenderer.invoke('save-image', imageData, defaultName),
  copyImageToClipboard: (imageData: string) => ipcRenderer.invoke('copy-image-to-clipboard', imageData),
  checkModelStatus: () => ipcRenderer.invoke('check-model-status'),
  selectModel: () => ipcRenderer.invoke('select-model'),
  loadCustomModel: (modelPath: string, modelId?: string) => ipcRenderer.invoke('load-custom-model', modelPath, modelId),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});
