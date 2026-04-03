import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import { open as openShell } from '@tauri-apps/plugin-shell';

export async function selectImage(): Promise<{path: string; data: string; name: string} | null> {
  const selected = await open({
    multiple: false,
    filters: [{
      name: '图片文件',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
    }]
  });
  
  if (!selected) return null;
  
  const path = selected as string;
  const name = path.split('/').pop() || 'image';
  
  const data = await readFile(path);
  // Convert Uint8Array to base64 without spread operator (avoid stack overflow for large files)
  let binary = '';
  const len = data.length;
  const chunkSize = 65536; // Process in chunks to avoid stack overflow
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  const base64 = btoa(binary);
  
  // 根据文件扩展名确定 MIME 类型
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const mimeTypeMap: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp'
  };
  const mimeType = mimeTypeMap[ext] || 'image/png';
  
  return { path, data: `data:${mimeType};base64,${base64}`, name };
}

export async function saveImage(imageData: string, defaultName?: string): Promise<string | null> {
  const filePath = await save({
    defaultPath: defaultName || 'removed_bg.png',
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

export async function selectModel(): Promise<{path: string; name: string; size: number} | null> {
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
  
  // Get file size
  try {
    const fileData = await readFile(path);
    return { path, name, size: fileData.length };
  } catch (e) {
    // If can't read file size, return 0
    return { path, name, size: 0 };
  }
}

export async function listFixedModels(): Promise<any> {
  return await invoke('list_fixed_models');
}

export async function loadFixedModel(modelId: string): Promise<any> {
  return await invoke('load_fixed_model', { modelId });
}

export async function loadCustomModel(modelPath: string, modelId: string): Promise<any> {
  return await invoke('load_custom_model', { modelPath, modelId });
}

export async function processImageWithModel(imageBase64: string): Promise<any> {
  return await invoke('process_image', { request: { image: imageBase64 } });
}

export async function openExternal(url: string): Promise<void> {
  await openShell(url);
}

export async function healthCheck(): Promise<any> {
  return await invoke('health_check');
}

export function windowMinimize() {
  getCurrentWindow().minimize();
}

export async function windowMaximize() {
  const win = getCurrentWindow();
  if (await win.isMaximized()) {
    await win.unmaximize();
  } else {
    await win.maximize();
  }
}

export function windowClose() {
  getCurrentWindow().close();
}
