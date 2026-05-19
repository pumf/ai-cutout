// 渲染层共享类型定义

export interface BatchTask {
  id: string;
  file: File;
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'retrying';
  progress: number;
  originalImage?: string;
  processedImage?: string;
  error?: string;
  retryCount: number;
  processingTime?: number;
}

export interface RecentFile {
  path: string;
  name: string;
  thumbnail: string;
  timestamp: number;
}

export interface CustomScene {
  name: string;
  color: string;
}

export type BgFillMode = 'cover' | 'contain' | 'center' | 'repeat' | 'custom';

export interface ModelInfo {
  id: string;
  name: string;
  display_name?: string;
  path: string | null;
  type: string;
  size_mb: number;
  exists: boolean;
  download_url?: string;
}

export interface CurrentModel {
  name: string;
  display_name?: string;
  path: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  releaseNotes?: string;
}

export interface ToastState {
  message: string;
  type: 'success' | 'info' | 'error';
  visible: boolean;
}

export interface DownloadDialogInfo {
  url: string;
  modelName: string;
  displayName: string;
}

// 下载进度（前端轮询用）
export interface ModelDownloadProgress {
  modelId: string;
  status: 'idle' | 'downloading' | 'extracting' | 'done' | 'error';
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  error?: string;
}
