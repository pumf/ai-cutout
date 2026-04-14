"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    selectImage: () => electron_1.ipcRenderer.invoke('select-image'),
    selectMultipleImages: () => electron_1.ipcRenderer.invoke('select-multiple-images'),
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    processImage: (imageData, filename) => electron_1.ipcRenderer.invoke('process-image', imageData, filename),
    saveImage: (imageData, defaultName) => electron_1.ipcRenderer.invoke('save-image', imageData, defaultName),
    saveImageToPath: (imageData, filePath) => electron_1.ipcRenderer.invoke('save-image-to-path', imageData, filePath),
    copyImageToClipboard: (imageData) => electron_1.ipcRenderer.invoke('copy-image-to-clipboard', imageData),
    checkModelStatus: () => electron_1.ipcRenderer.invoke('check-model-status'),
    selectModel: () => electron_1.ipcRenderer.invoke('select-model'),
    loadCustomModel: (modelPath, modelId) => electron_1.ipcRenderer.invoke('load-custom-model', modelPath, modelId),
    windowMinimize: () => electron_1.ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => electron_1.ipcRenderer.invoke('window-maximize'),
    windowClose: () => electron_1.ipcRenderer.invoke('window-close'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    getBackendPort: () => electron_1.ipcRenderer.invoke('get-backend-port'),
    checkPythonDeps: () => electron_1.ipcRenderer.invoke('check-python-deps'),
    installPythonDeps: () => electron_1.ipcRenderer.invoke('install-python-deps'),
});
