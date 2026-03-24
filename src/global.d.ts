interface ElectronAPI {
  selectImage: () => Promise<{path: string; data: string; name: string} | null>;
  processImage: (imageData: string, filename: string) => Promise<string>;
  saveImage: (imageData: string) => Promise<string | null>;
  checkModelStatus: () => Promise<{loaded: boolean; error?: string}>;
  selectModel: () => Promise<{path: string; name: string} | null>;
  loadCustomModel: (modelPath: string, modelId?: string) => Promise<{success: boolean; model?: any; detail?: string}>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
