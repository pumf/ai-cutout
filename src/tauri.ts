import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';

export async function selectImage(): Promise<{path: string; data: string; name: string} | null> {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Images',
      extensions: ['png', 'jpg', 'jpeg', 'webp']
    }]
  });
  
  if (!selected) return null;
  
  const path = selected as string;
  const name = path.split('/').pop() || 'image';
  
  const data = await readFile(path);
  const base64 = btoa(String.fromCharCode(...data));
  const mimeType = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  return { path, data: `data:${mimeType};base64,${base64}`, name };
}

export async function saveImage(imageData: string): Promise<string | null> {
  const filePath = await save({
    filters: [{
      name: 'Images',
      extensions: ['png']
    }]
  });
  
  if (!filePath) return null;
  
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  await writeFile(filePath, bytes);
  
  return filePath;
}

export async function selectModel(): Promise<{path: string; name: string} | null> {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'AI Models',
      extensions: ['onnx', 'safetensors']
    }]
  });
  
  if (!selected) return null;
  
  const path = selected as string;
  const name = path.split('/').pop() || 'model';
  
  return { path, name };
}

export async function checkModelStatus(): Promise<{loaded: boolean; error?: string}> {
  try {
    const response = await fetch('http://127.0.0.1:8765/model/status');
    return await response.json();
  } catch (error) {
    return { loaded: false, error: 'Backend not running' };
  }
}

export async function loadCustomModel(modelPath: string, modelId?: string) {
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
}

export function windowMinimize() {
  getCurrentWindow().minimize();
}

export function windowMaximize() {
  const win = getCurrentWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
}

export function windowClose() {
  getCurrentWindow().close();
}
