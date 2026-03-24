"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    selectImage: () => electron_1.ipcRenderer.invoke('select-image'),
    processImage: (imageData, filename) => electron_1.ipcRenderer.invoke('process-image', imageData, filename),
    saveImage: (imageData) => electron_1.ipcRenderer.invoke('save-image', imageData),
    checkModelStatus: () => electron_1.ipcRenderer.invoke('check-model-status'),
});
