import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GifReader, GifWriter } from 'omggif';
import { listFixedModels, loadFixedModel, loadCustomModel, processImageWithModel, selectModel, openExternalUrl, saveImage, selectImage, loadImageFromPath, copyImageToClipboard, checkForUpdates, getBackendPort, selectMultipleImages, selectFolder, saveImageToPath } from '../api';
import { TitleBar } from './components/TitleBar';

// 声明 vite 注入的全局变量
declare const __APP_VERSION__: string;

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [currentModel, setCurrentModel] = useState<{name: string; display_name?: string; path: string} | null>(null);
  const [availableModels, setAvailableModels] = useState<{id: string; name: string; display_name?: string; path: string | null; type: string; size_mb: number; exists: boolean; download_url?: string}[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [errorModelId, setErrorModelId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch processing states
  interface BatchTask {
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

  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchOutputDir, setBatchOutputDir] = useState<string>('');
  const [batchPrefix, setBatchPrefix] = useState<string>('removed_bg_');
  const [batchConcurrency, setBatchConcurrency] = useState<number>(2);
  const [outputFormat, setOutputFormat] = useState<'png' | 'webp' | 'jpg'>('png');
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; name: string; thumbnail: string; timestamp: number }>>([]);
  const abortBatchRef = useRef<boolean>(false);
  const batchAbortControllerRef = useRef<AbortController | null>(null);
  const batchStartTimeRef = useRef<number>(0);
  // 强制 ETA 在 task 间隙也刷新 — 每秒 +1,作为依赖让 progress 区重渲染
  const [etaTick, setEtaTick] = useState(0);
  const [selectedBatchTask, setSelectedBatchTask] = useState<BatchTask | null>(null);
  const [showBatchPreview, setShowBatchPreview] = useState(false);

  // Update check states
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseUrl?: string;
    releaseNotes?: string;
  } | null>(null);

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startTranslateRef = useRef({ x: 0, y: 0 });

  // Refs for direct DOM manipulation (avoid re-renders during drag/zoom)
  const scaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const brushSizeRef = useRef(20);
  const originalTransformRef = useRef<HTMLDivElement>(null);
  const resultTransformRef = useRef<HTMLDivElement>(null);

  // Edit mode states
  const [editMode, setEditMode] = useState<'none' | 'erase' | 'restore'>('none');
  const [brushSize, setBrushSize] = useState(20);
  
  // Sync brushSize with ref for performant cursor updates
  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);
  
  // Initialize backend port from main process
  useEffect(() => {
    const initPort = async () => {
      try {
        const port = await getBackendPort();
        console.log('Backend port initialized:', port);
      } catch (error) {
        console.error('Failed to get backend port:', error);
      }
    };
    initPort();
  }, []);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [maskHistory, setMaskHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isOriginalDragging, setIsOriginalDragging] = useState(false);
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);
  const [isMouseInOriginalPanel, setIsMouseInOriginalPanel] = useState(false);
  const [isMouseInResultPanel, setIsMouseInResultPanel] = useState(false);
  
  // Original panel collapse state
  const [isOriginalPanelCollapsed, setIsOriginalPanelCollapsed] = useState(false);
  
  // Background settings
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Brush slider tooltip state
  const [isAdjustingBrush, setIsAdjustingBrush] = useState(false);
  const [brushTooltipPos, setBrushTooltipPos] = useState({ x: 0, y: 0 });
  const brushSliderRef = useRef<HTMLInputElement>(null);
  const bgPickerRef = useRef<HTMLDivElement>(null);
  const zoomControlRef = useRef<HTMLDivElement>(null);

  // Toast state
  const [toast, setToast] = useState<{message: string; type: 'success' | 'info' | 'error'; visible: boolean}>({message: '', type: 'info', visible: false});
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcuts help
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Paste image confirmation
  const [showPasteConfirm, setShowPasteConfirm] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Download model dialog
  const [downloadDialog, setDownloadDialog] = useState<{ url: string; modelName: string; displayName: string } | null>(null);

  // GIF processing state
  const [isGifProcessing, setIsGifProcessing] = useState(false);
  const [gifProgress, setGifProgress] = useState({ current: 0, total: 0, message: '' });
  const [isOriginalGif, setIsOriginalGif] = useState(false);
  const [gifOriginalFrames, setGifOriginalFrames] = useState<string[]>([]);
  const [gifProcessedFrames, setGifProcessedFrames] = useState<string[]>([]);
  const [selectedGifFrame, setSelectedGifFrame] = useState<number | null>(null);
  const [showGifFramePreview, setShowGifFramePreview] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use refs for virtual cursor elements to avoid React re-render
  const originalCursorRef = useRef<HTMLDivElement>(null);
  const resultCursorRef = useRef<HTMLDivElement>(null);

  // Refs for smooth drawing
  const [originalStartPos, setOriginalStartPos] = useState({ x: 0, y: 0 });
  const [originalStartTranslate, setOriginalStartTranslate] = useState({ x: 0, y: 0 });

  const originalPanelRef = useRef<HTMLDivElement>(null);
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const originalImgRef = useRef<HTMLImageElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const origFramesListRef = useRef<HTMLDivElement>(null);
  const procFramesListRef = useRef<HTMLDivElement>(null);

  // Handle zoom with mouse position as anchor point - keep the point visually stationary
  const handleZoom = useCallback((e: WheelEvent, panelRef: React.RefObject<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.01, scaleRef.current * delta);
    
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const panelCenterX = rect.width / 2;
      const panelCenterY = rect.height / 2;
      const worldX = (mouseX - panelCenterX - translateXRef.current) / scaleRef.current;
      const worldY = (mouseY - panelCenterY - translateYRef.current) / scaleRef.current;
      
      const newTranslateX = mouseX - panelCenterX - worldX * newScale;
      const newTranslateY = mouseY - panelCenterY - worldY * newScale;
      
      updateTransform(newScale, newTranslateX, newTranslateY);
    } else {
      updateTransform(newScale, translateXRef.current, translateYRef.current);
    }
  }, []);

  // Direct DOM transform update (no re-render, batched with RAF)
  const rafRef = useRef<number | null>(null);
  const updateTransform = (s: number, tx: number, ty: number) => {
    scaleRef.current = s;
    translateXRef.current = tx;
    translateYRef.current = ty;

    // Sync scale state for UI updates (zoom badge)
    setScale(s);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${s})`;
      if (originalTransformRef.current) {
        originalTransformRef.current.style.transform = transform;
      }
      if (resultTransformRef.current) {
        resultTransformRef.current.style.transform = transform;
      }
      // Update cursor sizes
      const cursorSize = brushSizeRef.current * s;
      if (originalCursorRef.current) {
        originalCursorRef.current.style.width = `${cursorSize}px`;
        originalCursorRef.current.style.height = `${cursorSize}px`;
      }
      if (resultCursorRef.current) {
        resultCursorRef.current.style.width = `${cursorSize}px`;
        resultCursorRef.current.style.height = `${cursorSize}px`;
      }
    });
  };

  // Set specific zoom scale
  const setZoomScale = (targetScale: number) => {
    const newScale = Math.max(0.01, targetScale);
    setScale(newScale);
    setTranslateX(0);
    setTranslateY(0);
    updateTransform(newScale, 0, 0);
  };

  // Fit image to panel
  const fitToPanel = () => {
    if (originalPanelRef.current && originalImage) {
      const img = new Image();
      img.onload = () => {
        const panel = originalPanelRef.current;
        if (panel) {
          const panelW = panel.clientWidth;
          const panelH = panel.clientHeight;
          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;
          
          // Calculate scale to fit the entire image within panel
          const scaleW = panelW / imgW;
          const scaleH = panelH / imgH;
          const fitScale = Math.min(scaleW, scaleH);
          
          setScale(fitScale);
          setTranslateX(0);
          setTranslateY(0);
          updateTransform(fitScale, 0, 0);
        }
      };
      img.src = originalImage;
    }
  };

  useEffect(() => {
    const handleOriginalWheel = (e: WheelEvent) => handleZoom(e, originalPanelRef);
    const handleResultWheel = (e: WheelEvent) => handleZoom(e, resultPanelRef);

    const panel1 = originalPanelRef.current;
    const panel2 = resultPanelRef.current;

    panel1?.addEventListener('wheel', handleOriginalWheel, { passive: false });
    panel2?.addEventListener('wheel', handleResultWheel, { passive: false });

    return () => {
      panel1?.removeEventListener('wheel', handleOriginalWheel);
      panel2?.removeEventListener('wheel', handleResultWheel);
    };
  }, [handleZoom]);

  // GIF 帧列表内部滚动:父面板用 native 非 passive wheel 监听做缩放并 preventDefault,
  // 会取消列表的默认滚动。这里在列表上挂 native 监听,stopPropagation 后手动驱动 scrollTop。
  useEffect(() => {
    const handleListWheel = (e: WheelEvent) => {
      const list = e.currentTarget as HTMLDivElement;
      const container = list.querySelector('.gif-frames-container') as HTMLDivElement | null;
      if (!container) return;
      e.preventDefault();
      e.stopPropagation();
      container.scrollTop += e.deltaY;
    };
    const origList = origFramesListRef.current;
    const procList = procFramesListRef.current;
    origList?.addEventListener('wheel', handleListWheel, { passive: false });
    procList?.addEventListener('wheel', handleListWheel, { passive: false });
    return () => {
      origList?.removeEventListener('wheel', handleListWheel);
      procList?.removeEventListener('wheel', handleListWheel);
    };
  }, [isOriginalGif, gifOriginalFrames.length, gifProcessedFrames.length]);

  const loadAvailableModels = async () => {
    try {
      const data = await listFixedModels();
      
      if (data && data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        
        if (data.current_model?.loaded) {
          setCurrentModel(data.current_model);
          setModelStatus('ready');
        } else {
          setModelStatus('error');
        }
      } else {
        setAvailableModels([]);
        setModelStatus('error');
        showToast('模型列表为空，请重试', 'error');
      }
    } catch (e) {
      console.error('Failed to load models:', e);
      setModelStatus('error');
      
      let errorMsg = '未知错误';
      if (e instanceof Error) {
        errorMsg = e.message;
      } else if (typeof e === 'string') {
        errorMsg = e;
      } else if (e && typeof e === 'object') {
        try {
          errorMsg = JSON.stringify(e);
        } catch {
          errorMsg = '无法序列化的错误对象';
        }
      }
      
      showToast(`加载模型失败: ${errorMsg}`, 'error');
    }
  };

  const handleLoadFixedModel = async (modelId: string) => {
    setLoadingModelId(modelId);
    setErrorModelId(null);
    setIsLoadingModel(true);
    setModelStatus('loading');
    try {
      const data = await loadFixedModel(modelId);
      if (data.success) {
        setCurrentModel(data.model);
        setModelStatus('ready');
        setShowModelSelector(false);
        // Refresh model list
        loadAvailableModels();
        showToast(`模型 ${data.model.display_name || data.model.name} 加载成功`, 'success');
      } else {
        setErrorModelId(modelId);
        showToast('加载模型失败: ' + (data.error || '未知错误'), 'error');
        // Clear error after 3 seconds
        setTimeout(() => setErrorModelId(null), 3000);
      }
    } catch (e) {
      console.error('Failed to load model:', e);
      setErrorModelId(modelId);
      showToast('加载模型失败', 'error');
      // Clear error after 3 seconds
      setTimeout(() => setErrorModelId(null), 3000);
    } finally {
      setIsLoadingModel(false);
      setLoadingModelId(null);
    }
  };

  const selectCustomModel = async (modelId: string) => {
    setIsLoadingModel(true);
    try {
      const result = await selectModel();
      if (!result) return;
      setModelStatus('loading');
      const loadResult = await loadCustomModel(result.path, modelId);
      if (loadResult.success) {
        setCurrentModel(loadResult.model);
        setModelStatus('ready');

        // Update available models to reflect the custom loaded model
        setAvailableModels(prev => prev.map(m => {
          if (m.id === modelId) {
            // Calculate file size in MB
            const fileSizeMB = Math.round(result.size / (1024 * 1024));
            return {
              ...m,
              exists: true,
              size_mb: fileSizeMB,
              path: result.path
            };
          }
          return m;
        }));

        showToast('模型加载成功', 'success');
      } else {
        setModelStatus('error');
        showToast('加载模型失败: ' + (loadResult.error || '未知错误'), 'error');
      }
    } catch (e) {
      console.error('Failed to load custom model:', e);
      setModelStatus('error');
      showToast('加载模型失败', 'error');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleDownloadModel = (url: string, modelName: string, displayName: string) => {
    setDownloadDialog({ url, modelName, displayName });
  };

  const handleUpdateDismiss = () => {
    setShowUpdateDialog(false);
  };

  const handleUpdateDownload = async () => {
    if (updateInfo?.releaseUrl) {
      try {
        await openExternalUrl(updateInfo.releaseUrl);
        showToast('正在打开下载页面...', 'info');
        setShowUpdateDialog(false);
      } catch (e) {
        console.error('Failed to open download page:', e);
        showToast('打开下载页面失败', 'error');
      }
    }
  };

  useEffect(() => {
    // Load models immediately
    const initTimer = setTimeout(() => {
      loadAvailableModels();
    }, 100);

    // Disable context menu (right-click) to prevent "Reload" option
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      clearTimeout(initTimer);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Check for updates on app start
  useEffect(() => {
    const checkUpdatesWithRetry = async (retryCount = 0) => {
      try {
        // Wait for electronAPI to be ready
        if (!window.electronAPI) {
          console.log('Waiting for electronAPI to be ready...');
          if (retryCount < 5) {
            setTimeout(() => checkUpdatesWithRetry(retryCount + 1), 1000);
          } else {
            console.error('electronAPI not available after retries');
          }
          return;
        }

        // Delay update check to not interfere with app startup
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Checking for updates...');
        const result = await checkForUpdates();
        console.log('Update check result:', result);

        if (result.hasUpdate) {
          console.log(`New version available: ${result.latestVersion}`);
          setUpdateInfo(result);
          setShowUpdateDialog(true);
        } else {
          console.log('No updates available or already on latest version');
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
        // Silently fail - don't show error to user for update checks
      }
    };

    // Start checking after a short delay to ensure app is fully loaded
    setTimeout(() => checkUpdatesWithRetry(), 1000);
  }, []);

  // Listen for auto-load completion
  useEffect(() => {
    const timer = setInterval(() => {
      loadAvailableModels();
    }, 5000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleSelectImage = async () => {
    try {
      const result = await selectImage();
      if (!result) return; // User cancelled

      if (originalImage || processedImage) {
        // Show confirmation if there's already an image
        // Store the image data directly
        setPendingImageUrl(result.data);
        setShowPasteConfirm(true);
      } else {
        // Load directly if no image exists
        loadImageWithFit(result.data);
      }
      // 记录到最近文件(仅 dialog 选择路径,因有可靠 path)
      pushRecentFile(result.path, result.name, result.data);
    } catch (error) {
      console.error('Failed to select image:', error);
      showToast('选择图片失败', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (originalImage || processedImage) {
        // Show confirmation if there's already an image
        setPendingFile(file);
        setShowPasteConfirm(true);
        // Clear the input
        e.target.value = '';
      } else {
        // Load directly if no image exists
        loadFileImage(file);
      }
    }
  };

  // Load file as image
  const loadFileImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      loadImageWithFit(imageUrl);
    };
    reader.readAsDataURL(file);
  };

  // Process a single image frame
  const processImageFrame = async (base64Data: string, signal?: AbortSignal): Promise<Blob> => {
    console.log('[Process] Starting image processing, base64 length:', base64Data.length);

    try {
      const data = await processImageWithModel(base64Data, signal);
      console.log('[Process] API response:', data);
      
      if (!data.success) {
        console.error('[Process] API returned error:', data.error);
        throw new Error(data.error || '处理失败');
      }
      
      if (!data.image) {
        console.error('[Process] No image in response');
        throw new Error('处理结果为空');
      }
      
      // Convert base64 response to Blob
      const base64Image = data.image.replace(/^data:image\/\w+;base64,/, '');
      console.log('[Process] Converted base64 length:', base64Image.length);
      
      const binaryString = atob(base64Image);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('[Process] Created blob with size:', bytes.length);
      return new Blob([bytes], { type: 'image/png' });
    } catch (error) {
      console.error('[Process] Error in processImageFrame:', error);
      throw error;
    }
  };

  // Cancel GIF processing
  const cancelGifProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGifProcessing(false);
    setGifProgress({ current: 0, total: 0, message: "" });
    showToast('已取消 GIF 处理', 'info');
  };

  // Helper function to quantize colors and create palette with transparency support
  const createPalette = (rgbaData: Uint8Array, maxColors: number = 255): { palette: number[]; indices: Uint8Array; transparentIndex: number | null } => {
    // Check if data is valid
    if (!rgbaData || rgbaData.length === 0) {
      // Return minimum palette with transparency support
      return { 
        palette: [0, 0, 0, 255, 255, 255], 
        indices: new Uint8Array(1),
        transparentIndex: 0
      };
    }
    
    // Simple quantization: collect unique colors
    const colorMap = new Map<string, number>();
    const palette: number[] = [];
    const indices = new Uint8Array(rgbaData.length / 4);
    let hasTransparentPixels = false;
    const transparentThreshold = 128; // Alpha < 128 is considered transparent
    
    // Reserve index 0 for transparent color
    palette.push(0, 0, 0); // Black color for transparent index
    
    for (let i = 0; i < rgbaData.length; i += 4) {
      const r = rgbaData[i];
      const g = rgbaData[i + 1];
      const b = rgbaData[i + 2];
      const a = rgbaData[i + 3];
      
      // Check if pixel is transparent
      if (a < transparentThreshold) {
        indices[i / 4] = 0; // Index 0 is reserved for transparent
        hasTransparentPixels = true;
        continue;
      }
      
      // Use color as key (ignore alpha for palette)
      const colorKey = `${r},${g},${b}`;
      
      let colorIndex = colorMap.get(colorKey);
      if (colorIndex === undefined) {
        // Reserve one slot for transparency, so maxColors - 1 for actual colors
        if (palette.length / 3 < maxColors) {
          colorIndex = palette.length / 3;
          colorMap.set(colorKey, colorIndex);
          palette.push(r, g, b);
        } else {
          // Find closest color in palette (skip index 0 which is for transparency)
          colorIndex = 1;
          let minDistance = Infinity;
          for (let j = 3; j < palette.length; j += 3) {
            const pr = palette[j];
            const pg = palette[j + 1];
            const pb = palette[j + 2];
            const distance = Math.sqrt(
              Math.pow(r - pr, 2) + 
              Math.pow(g - pg, 2) + 
              Math.pow(b - pb, 2)
            );
            if (distance < minDistance) {
              minDistance = distance;
              colorIndex = j / 3;
            }
          }
        }
      }
      
      indices[i / 4] = colorIndex;
    }
    
    // Ensure palette size is power of 2 (2, 4, 8, 16, 32, 64, 128, 256)
    let numColors = palette.length / 3;
    
    // Always use at least 2 colors (minimum required)
    if (numColors < 2) {
      palette.push(255, 255, 255);
      numColors = 2;
    }
    
    // Find the next power of 2
    let targetSize = 2;
    while (targetSize < numColors && targetSize < 256) {
      targetSize *= 2;
    }
    
    // Fill remaining palette with black to reach targetSize
    while (palette.length / 3 < targetSize) {
      palette.push(0, 0, 0);
    }
    
    // Final validation
    let finalColorCount = palette.length / 3;
    const validSizes = [2, 4, 8, 16, 32, 64, 128, 256];
    
    if (!validSizes.includes(finalColorCount)) {
      if (finalColorCount > 256) {
        palette.length = 256 * 3;
      } else {
        let validSize = 256;
        for (const size of [...validSizes].reverse()) {
          if (size <= finalColorCount) {
            validSize = size;
            break;
          }
        }
        while (palette.length / 3 > validSize) {
          palette.pop();
          palette.pop();
          palette.pop();
        }
        while (palette.length / 3 < validSize) {
          palette.push(0, 0, 0);
        }
      }
      finalColorCount = palette.length / 3;
    }
    
    return { 
      palette, 
      indices, 
      transparentIndex: hasTransparentPixels ? 0 : null 
    };
  };

  // Process GIF file
  const processGif = async (gifBuffer: ArrayBuffer, _originalUrl: string) => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      setIsGifProcessing(true);
      showToast('正在处理 GIF 动画...', 'info');
      
      // Parse GIF
      let gifReader;
      try {
        gifReader = new GifReader(new Uint8Array(gifBuffer));
      } catch (parseErr) {
        throw new Error(`GIF 解析失败: ${(parseErr as Error).message}`);
      }
      
      const numFrames = gifReader.numFrames();
      const width = gifReader.width;
      const height = gifReader.height;
      
      if (numFrames === 0) {
        throw new Error('GIF 文件不包含任何帧');
      }
      
      // 与批量处理共用同一个并发设置(批量对话框可配置;默认 2)
      const concurrency = Math.max(1, Math.min(8, batchConcurrency));
      
      showToast(`正在处理 ${numFrames} 帧 GIF...`, 'info');
      
      setGifProgress({ current: 0, total: numFrames, message: '' });
      
      // Step 1: Extract all frames first
      const frames: { index: number; base64: string; delay: number }[] = [];
      const originalFrameUrls: string[] = [];
      
      for (let i = 0; i < numFrames; i++) {
        const frameInfo = gifReader.frameInfo(i);
        const pixels = new Uint8Array(width * height * 4);
        gifReader.decodeAndBlitFrameRGBA(i, pixels);
        
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
        if (!frameCtx) throw new Error('无法创建 frame canvas context');
        
        const imageData = frameCtx.createImageData(width, height);
        imageData.data.set(pixels);
        frameCtx.putImageData(imageData, 0, 0);
        
        const frameBase64 = frameCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
        frames.push({ index: i, base64: frameBase64, delay: frameInfo.delay });
        
        // Save original frame URL for display
        originalFrameUrls.push(frameCanvas.toDataURL('image/png'));
      }
      
      // Store original frames for display
      setGifOriginalFrames(originalFrameUrls);
      
      // Step 2: Process first frame to determine output size
      showToast('正在处理第 1 帧 (确定输出尺寸)...', 'info');
      const firstFrameResult = await (async (): Promise<{
        index: number;
        indices: Uint8Array;
        palette: number[];
        delay: number;
        transparentIndex: number | null;
        error?: boolean;
        width: number;
        height: number;
      }> => {
        const frame = frames[0];
        try {
          let processedBlob = await processImageFrame(frame.base64);
          const processedUrl = URL.createObjectURL(processedBlob);
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('第一帧加载失败'));
            img.src = processedUrl;
          });
          
          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = img.width;
          frameCanvas.height = img.height;
          const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
          if (!frameCtx) throw new Error('无法创建 frame context');
          
          frameCtx.clearRect(0, 0, img.width, img.height);
          frameCtx.drawImage(img, 0, 0);
          URL.revokeObjectURL(processedUrl);
          
          const processedImageData = frameCtx.getImageData(0, 0, img.width, img.height);
          const processedPixels = new Uint8Array(processedImageData.data);
          const { palette, indices, transparentIndex } = createPalette(processedPixels);
          
          return {
            index: frame.index,
            indices,
            palette,
            delay: frame.delay,
            transparentIndex,
            error: false,
            width: img.width,
            height: img.height
          };
        } catch (err) {
          // Retry
          try {
            const retryBlob = await processImageFrame(frame.base64);
            const retryUrl = URL.createObjectURL(retryBlob);
            const retryImg = new Image();
            await new Promise<void>((resolve, reject) => {
              retryImg.onload = () => resolve();
              retryImg.onerror = () => reject(new Error('重试失败'));
              retryImg.src = retryUrl;
            });
            
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = retryImg.width;
            frameCanvas.height = retryImg.height;
            const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
            if (!frameCtx) throw new Error('无法创建 frame context');
            
            frameCtx.clearRect(0, 0, retryImg.width, retryImg.height);
            frameCtx.drawImage(retryImg, 0, 0);
            URL.revokeObjectURL(retryUrl);
            
            const retryImageData = frameCtx.getImageData(0, 0, retryImg.width, retryImg.height);
            const retryPixels = new Uint8Array(retryImageData.data);
            const { palette: retryPalette, indices: retryIndices, transparentIndex: retryTransparentIndex } = createPalette(retryPixels);
            
            return {
              index: frame.index,
              indices: retryIndices,
              palette: retryPalette,
              delay: frame.delay,
              transparentIndex: retryTransparentIndex,
              error: false,
              width: retryImg.width,
              height: retryImg.height
            };
          } catch (retryErr) {
            return {
              index: frame.index,
              indices: new Uint8Array(width * height),
              palette: [0, 0, 0, 255, 255, 255],
              delay: frame.delay,
              transparentIndex: 0,
              error: true,
              width,
              height
            };
          }
        }
      })();
      
      // 使用第一帧处理后的尺寸作为输出尺寸
      const outputWidth = firstFrameResult.width;
      const outputHeight = firstFrameResult.height;
      
      console.log(`[GIF] 原始尺寸: ${width}x${height}, 输出尺寸: ${outputWidth}x${outputHeight}`);
      
      // Step 3: Process remaining frames using the same output size
      const processedFrames: typeof firstFrameResult[] = [firstFrameResult];
      
      if (numFrames > 1) {
        let completedCount = 1; // 第一帧已完成
        let processingCount = 0;
        
        const processSingleFrame = async (frame: typeof frames[0]): Promise<typeof firstFrameResult> => {
          processingCount++;
          
          try {
            let processedBlob = await processImageFrame(frame.base64);
            const processedUrl = URL.createObjectURL(processedBlob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('处理后的图片加载失败'));
              img.src = processedUrl;
            });
            
            // 使用统一的输出尺寸
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = outputWidth;
            frameCanvas.height = outputHeight;
            const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
            if (!frameCtx) throw new Error('无法创建 frame context');
            
            // 清除并设置为透明
            frameCtx.clearRect(0, 0, outputWidth, outputHeight);
            // 绘制图片（会自动缩放/裁剪到 canvas 尺寸）
            frameCtx.drawImage(img, 0, 0, outputWidth, outputHeight);
            URL.revokeObjectURL(processedUrl);
            
            const processedImageData = frameCtx.getImageData(0, 0, outputWidth, outputHeight);
            const processedPixels = new Uint8Array(processedImageData.data);
            const { palette, indices, transparentIndex } = createPalette(processedPixels);
            
            completedCount++;
            processingCount--;
            
            setGifProgress({ 
              current: completedCount, 
              total: numFrames,
              message: ''
            });
            
            return {
              index: frame.index,
              indices,
              palette,
              delay: frame.delay,
              transparentIndex,
              error: false,
              width: outputWidth,
              height: outputHeight
            };
          } catch (err) {
            // Retry
            try {
              const retryBlob = await processImageFrame(frame.base64);
              const retryUrl = URL.createObjectURL(retryBlob);
              const retryImg = new Image();
              await new Promise<void>((resolve, reject) => {
                retryImg.onload = () => resolve();
                retryImg.onerror = () => reject(new Error('重试失败'));
                retryImg.src = retryUrl;
              });
              
              const frameCanvas = document.createElement('canvas');
              frameCanvas.width = outputWidth;
              frameCanvas.height = outputHeight;
              const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
              if (!frameCtx) throw new Error('无法创建 frame context');
              
              frameCtx.clearRect(0, 0, outputWidth, outputHeight);
              frameCtx.drawImage(retryImg, 0, 0, outputWidth, outputHeight);
              URL.revokeObjectURL(retryUrl);
              
              const retryImageData = frameCtx.getImageData(0, 0, outputWidth, outputHeight);
              const retryPixels = new Uint8Array(retryImageData.data);
              const { palette: retryPalette, indices: retryIndices, transparentIndex: retryTransparentIndex } = createPalette(retryPixels);
              
              completedCount++;
              processingCount--;
              setGifProgress({ current: completedCount, total: numFrames, message: "" });
              
              return {
                index: frame.index,
                indices: retryIndices,
                palette: retryPalette,
                delay: frame.delay,
                transparentIndex: retryTransparentIndex,
                error: false,
                width: outputWidth,
                height: outputHeight
              };
            } catch (retryErr) {
              completedCount++;
              processingCount--;
              setGifProgress({ current: completedCount, total: numFrames, message: "" });
              return {
                index: frame.index,
                indices: new Uint8Array(outputWidth * outputHeight),
                palette: [0, 0, 0, 255, 255, 255],
                delay: frame.delay,
                transparentIndex: 0,
                error: true,
                width: outputWidth,
                height: outputHeight
              };
            }
          }
        };
        
        // Process remaining frames with concurrency
        const remainingFrames = frames.slice(1);
        const iterator = remainingFrames[Symbol.iterator]();
        const workers: Promise<void>[] = [];
        
        const worker = async () => {
          for (const frame of iterator) {
            if (signal.aborted) {
              throw new Error('Cancelled');
            }
            const result = await processSingleFrame(frame);
            processedFrames.push(result);
          }
        };
        
        for (let i = 0; i < Math.min(concurrency, remainingFrames.length); i++) {
          workers.push(worker());
        }
        
        await Promise.all(workers);
      }
      
      // Sort by index to maintain order
      processedFrames.sort((a, b) => a.index - b.index);
      
      // Check for errors
      const failedFrames = processedFrames.filter(f => f.error);
      if (failedFrames.length > 0) {
        console.error(`${failedFrames.length} 帧处理失败`);
      }
      
      if (processedFrames.length === 0) {
        throw new Error('没有成功处理任何帧');
      }
      
      // 输出尺寸已经在前面确定
      console.log(`[GIF] 原始尺寸: ${width}x${height}, 输出尺寸: ${outputWidth}x${outputHeight}`);
      
      // Create new GIF with larger buffer
      const estimatedSize = outputWidth * outputHeight * numFrames * 4 + 10 * 1024 * 1024;
      const outputBuffer = new Uint8Array(estimatedSize);
      
      let gifWriter;
      try {
        gifWriter = new GifWriter(outputBuffer, outputWidth, outputHeight, { loop: 0 });
      } catch (writerErr) {
        throw new Error(`GIF Writer 创建失败: ${(writerErr as Error).message}`);
      }
      
      for (let i = 0; i < processedFrames.length; i++) {
        const frame = processedFrames[i];
        try {
          // 验证调色板
          if (!frame.palette || frame.palette.length === 0) {
            throw new Error(`第 ${i + 1} 帧调色板为空`);
          }
          
          // 验证索引数据 - 使用输出尺寸
          if (!frame.indices || frame.indices.length !== outputWidth * outputHeight) {
            throw new Error(`第 ${i + 1} 帧索引数据无效: ${frame.indices?.length} != ${outputWidth * outputHeight}`);
          }
          
          const numColors = frame.palette.length / 3;
          const validSizes = [2, 4, 8, 16, 32, 64, 128, 256];
          if (!validSizes.includes(numColors)) {
            throw new Error(`第 ${i + 1} 帧调色板大小 ${numColors} 不是有效的2的幂次方`);
          }
          
          // Convert palette to omggif format: array of 0xRRGGBB integers
          const paletteForOmggif: number[] = [];
          for (let j = 0; j < frame.palette.length; j += 3) {
            const r = frame.palette[j];
            const g = frame.palette[j + 1];
            const b = frame.palette[j + 2];
            paletteForOmggif.push((r << 16) | (g << 8) | b);
          }
          
          // Build addFrame options
          const addFrameOpts: { delay: number; palette: number[]; transparent?: number; disposal?: number } = {
            delay: frame.delay,
            palette: paletteForOmggif,
            disposal: 2  // 2 = Restore to background color (transparent)
          };
          
          // Add transparent index if there are transparent pixels
          if (frame.transparentIndex !== null) {
            addFrameOpts.transparent = frame.transparentIndex;
          }
          
          gifWriter.addFrame(0, 0, outputWidth, outputHeight, frame.indices, addFrameOpts);
        } catch (frameErr) {
          throw new Error(`添加帧 ${i + 1} 失败: ${(frameErr as Error).message}`);
        }
      }
      
      let gifLength;
      try {
        gifLength = gifWriter.end();
      } catch (endErr) {
        throw new Error(`GIF 编码结束失败: ${(endErr as Error).message}`);
      }
      
      const finalGif = outputBuffer.slice(0, gifLength);
      
      const blob = new Blob([finalGif], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
      setIsOriginalGif(true);
      
      // Generate processed frame URLs for display
      const processedFrameUrls: string[] = [];
      for (const frame of processedFrames) {
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = frame.width;
        frameCanvas.height = frame.height;
        const frameCtx = frameCanvas.getContext('2d');
        if (frameCtx) {
          // Reconstruct image from indices and palette
          const imageData = frameCtx.createImageData(frame.width, frame.height);
          for (let i = 0; i < frame.indices.length; i++) {
            const idx = frame.indices[i];
            if (idx < frame.palette.length / 3) {
              imageData.data[i * 4] = frame.palette[idx * 3];
              imageData.data[i * 4 + 1] = frame.palette[idx * 3 + 1];
              imageData.data[i * 4 + 2] = frame.palette[idx * 3 + 2];
              imageData.data[i * 4 + 3] = idx === frame.transparentIndex ? 0 : 255;
            }
          }
          frameCtx.putImageData(imageData, 0, 0);
          processedFrameUrls.push(frameCanvas.toDataURL('image/png'));
        }
      }
      setGifProcessedFrames(processedFrameUrls);
      
      showToast('GIF 抠图完成！', 'success');
    } catch (err) {
      if ((err as Error).message === 'Cancelled') {
        return;
      }
      const errorMessage = (err as Error).message || '未知错误';
      showToast(`GIF 处理失败: ${errorMessage}`, 'error');
    } finally {
      setIsGifProcessing(false);
      setGifProgress({ current: 0, total: 0, message: "" });
      abortControllerRef.current = null;
    }
  };

  const handleProcess = async () => {
    if (!originalImage) return;
    
    if (modelStatus !== 'ready') {
      setShowModelSelector(true);
      showToast('请先选择一个AI模型', 'error');
      return;
    }
    
    // Check if it's a GIF
    if (originalImage.startsWith('data:image/gif')) {
      // Convert data URL to ArrayBuffer
      const base64Data = originalImage.split(',')[1];
      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await processGif(bytes.buffer, originalImage);
      return;
    }
    
    setIsProcessing(true);
    try {
      const base64Data = originalImage.replace(/^data:image\/\w+;base64,/, '');
      
      const blob = await processImageFrame(base64Data);
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
      setIsOriginalGif(false);
      showToast('AI 抠图完成！', 'success');
    } catch (e) {
      console.error('Processing failed:', e);
      const errorMsg = (e as Error).message || '未知错误';
      showToast(`处理失败: ${errorMsg}`, 'error');
      
      // 显示详细错误信息
      alert(`抠图失败详情：\n${errorMsg}\n\n请检查：\n1. 是否正确打开 Tauri 应用（不是旧版 Electron）\n2. 模型是否成功加载\n3. 查看浏览器控制台获取更多错误信息`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 辅助函数：将 ArrayBuffer 安全地转换为 base64（避免栈溢出）
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB chunks
    let result = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      result += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(result);
  };

  // 把 PNG dataURL 用 canvas 重新编码到目标格式;jpg 不支持透明,先铺白底
  const convertImageFormat = (dataUrl: string, format: 'png' | 'webp' | 'jpg'): Promise<string> => {
    if (format === 'png') return Promise.resolve(dataUrl);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas 2d 不可用'));
        if (format === 'jpg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/webp';
        resolve(canvas.toDataURL(mime, 0.92));
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = dataUrl;
    });
  };

  const formatExt = (f: 'png' | 'webp' | 'jpg') => f === 'jpg' ? 'jpg' : f;

  // 智能裁切:扫描 alpha 通道找非透明区域 bbox,裁紧后返回新 PNG dataURL
  // alpha 阈值取 10 是为了忽略肉眼几乎不可见的边缘羽化噪点
  const cropToContent = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext('2d');
        if (!ctx) return reject(new Error('canvas 2d 不可用'));
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
        const { data, width, height } = imgData;
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) { resolve(dataUrl); return; } // 全透明,不裁
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (w === width && h === height) { resolve(dataUrl); return; } // 无可裁
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const octx = out.getContext('2d')!;
        octx.putImageData(imgData, -minX, -minY);
        resolve(out.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = dataUrl;
    });
  };

  // 释放上一个 processedImage 的 blob URL(重新抠图 / 切换图片时避免内存泄漏)
  // useEffect cleanup 时机:新 processedImage 已 commit 到 DOM 后,旧 url 不再被引用
  useEffect(() => {
    return () => {
      if (processedImage && processedImage.startsWith('blob:')) {
        URL.revokeObjectURL(processedImage);
      }
    };
  }, [processedImage]);

  // 最近文件:启动时从 localStorage 读取
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentFiles');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentFiles(parsed);
      }
    } catch (e) {
      console.warn('Failed to load recent files:', e);
    }
  }, []);

  // 用户偏好:导出格式 / 智能裁切 / 批量前缀 / 批量并发 — 启动读 + 变更写
  // 注意:不持久化 bgColor(每次启动期望默认透明,避免上次的颜色残留干扰)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userPrefs');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.outputFormat === 'png' || p.outputFormat === 'webp' || p.outputFormat === 'jpg') setOutputFormat(p.outputFormat);
      if (typeof p.autoCrop === 'boolean') setAutoCrop(p.autoCrop);
      if (typeof p.batchPrefix === 'string') setBatchPrefix(p.batchPrefix);
      if (typeof p.batchConcurrency === 'number' && p.batchConcurrency >= 1 && p.batchConcurrency <= 8) setBatchConcurrency(p.batchConcurrency);
    } catch (e) {
      console.warn('Failed to load user prefs:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('userPrefs', JSON.stringify({
        outputFormat, autoCrop, batchPrefix, batchConcurrency,
      }));
    } catch {}
  }, [outputFormat, autoCrop, batchPrefix, batchConcurrency]);

  // 生成 96x96 缩略图(对原始 dataURL 等比缩放居中);失败则返回空串
  const generateThumbnail = (dataUrl: string, size = 96): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = size;
          cv.height = size;
          const ctx = cv.getContext('2d')!;
          // 棋盘格背景(暗示可能含透明)
          ctx.fillStyle = '#f3f4f6';
          ctx.fillRect(0, 0, size, size);
          const ratio = Math.min(size / img.naturalWidth, size / img.naturalHeight);
          const w = img.naturalWidth * ratio;
          const h = img.naturalHeight * ratio;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(cv.toDataURL('image/jpeg', 0.7));
        } catch { resolve(''); }
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  };

  // 把一条记录追加到最近文件,去重 + 按 path 取最新 + 最多 8 条
  const pushRecentFile = async (path: string, name: string, dataUrl: string) => {
    if (!path) return; // 没有路径无法重新加载,不存
    const thumbnail = await generateThumbnail(dataUrl);
    if (!thumbnail) return;
    setRecentFiles(prev => {
      const filtered = prev.filter(r => r.path !== path);
      const next = [{ path, name, thumbnail, timestamp: Date.now() }, ...filtered].slice(0, 8);
      try { localStorage.setItem('recentFiles', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeRecentFile = (path: string) => {
    setRecentFiles(prev => {
      const next = prev.filter(r => r.path !== path);
      try { localStorage.setItem('recentFiles', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleOpenRecent = async (entry: { path: string; name: string }) => {
    try {
      const res = await loadImageFromPath(entry.path);
      if (!res.success) {
        showToast(res.error === 'NOT_FOUND' ? '文件不存在或已移动' : '加载失败', 'error');
        removeRecentFile(entry.path);
        return;
      }
      if (originalImage || processedImage) {
        setPendingImageUrl(res.data);
        setShowPasteConfirm(true);
      } else {
        loadImageWithFit(res.data);
      }
      // 更新该条目时间戳到最前
      pushRecentFile(res.path, res.name, res.data);
    } catch (e) {
      console.error('Failed to open recent file:', e);
      showToast('加载失败', 'error');
    }
  };

  // 批量处理时每秒触发一次 ETA 重算
  useEffect(() => {
    if (!isBatchProcessing) return;
    const id = setInterval(() => setEtaTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isBatchProcessing]);

  // 把毫秒数格式化为 "X 秒" / "X 分 Y 秒" / "X 小时 Y 分"
  const formatEta = (ms: number): string => {
    if (!isFinite(ms) || ms < 0) return '--';
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec} 秒`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (min < 60) return remSec > 0 ? `${min} 分 ${remSec} 秒` : `${min} 分`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin > 0 ? `${hr} 小时 ${remMin} 分` : `${hr} 小时`;
  };

  // Batch processing functions
  const handleBatchFilesSelect = async () => {
    try {
      const result = await selectMultipleImages();
      if (result && result.length > 0) {
        // Convert the result to File objects
        const files: File[] = result.map((item: any) => {
          const byteCharacters = atob(item.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          return new File([byteArray], item.name, { type: item.type });
        });
        
        // Filter out GIF files
        const validFiles = files.filter(file => {
          const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
          if (isGif) {
            showToast(`已跳过 GIF 文件: ${file.name}`, 'info');
          }
          return !isGif;
        });
        
        if (validFiles.length === 0) {
          showToast('未选择有效的图片文件（不支持 GIF）', 'error');
          return;
        }
        
        const newTasks: BatchTask[] = validFiles.map(file => ({
          id: Math.random().toString(36).substr(2, 9),
          file,
          fileName: file.name,
          status: 'pending',
          progress: 0,
          retryCount: 0
        }));
        setBatchTasks(prev => [...prev, ...newTasks]);
      }
    } catch (err) {
      console.error('Failed to select files:', err);
      showToast('选择文件失败', 'error');
    }
  };

  const handleRemoveBatchTask = (taskId: string) => {
    setBatchTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleClearBatchTasks = () => {
    if (isBatchProcessing) {
      showToast('请先停止处理', 'error');
      return;
    }
    setBatchTasks([]);
  };

  const processBatchTask = async (task: BatchTask, signal?: AbortSignal): Promise<boolean> => {
    try {
      // Read file
      const arrayBuffer = await task.file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Check if GIF
      const isGif = task.file.type === 'image/gif' || 
                    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      
      if (isGif) {
        // For GIF, we need special handling - skip for now or process as first frame
        setBatchTasks(prev => prev.map(t => 
          t.id === task.id ? { ...t, status: 'processing', progress: 50 } : t
        ));
        
        // For batch processing, we skip GIF or process first frame only
        // This is a simplified version - full GIF processing is too slow for batch
        const blob = new Blob([arrayBuffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        setBatchTasks(prev => prev.map(t => {
          if (t.id !== task.id) return t;
          if (t.processedImage && t.processedImage.startsWith('blob:') && t.processedImage !== url) {
            URL.revokeObjectURL(t.processedImage);
          }
          return { ...t, status: 'success', progress: 100, processedImage: url, originalImage: url };
        }));
        return true;
      }
      
      // Process as regular image
      setBatchTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'processing', progress: 30 } : t
      ));
      
      // Convert to base64
      const base64 = arrayBufferToBase64(arrayBuffer);
      
      setBatchTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, progress: 50 } : t
      ));
      
      // Process with AI model
      const processedBlob = await processImageFrame(base64, signal);
      const url = URL.createObjectURL(processedBlob);

      setBatchTasks(prev => prev.map(t => {
        if (t.id !== task.id) return t;
        if (t.processedImage && t.processedImage.startsWith('blob:') && t.processedImage !== url) {
          URL.revokeObjectURL(t.processedImage);
        }
        return {
          ...t,
          status: 'success',
          progress: 100,
          processedImage: url,
          originalImage: `data:image/png;base64,${base64}`
        };
      }));

      return true;
    } catch (err) {
      // 用户主动取消:不标错误,恢复为 pending 以便后续重启批量
      const isAbort = (err as any)?.name === 'AbortError' || signal?.aborted;
      if (isAbort) {
        setBatchTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, status: 'pending', progress: 0, error: undefined } : t
        ));
        return false;
      }
      console.error('Batch processing failed:', err);
      setBatchTasks(prev => prev.map(t =>
        t.id === task.id ? {
          ...t,
          status: 'error',
          error: (err as Error).message,
          progress: 0
        } : t
      ));
      return false;
    }
  };

  const processBatchWithRetry = async (task: BatchTask, signal?: AbortSignal): Promise<boolean> => {
    // First attempt
    let success = await processBatchTask(task, signal);

    // Auto retry once if failed (but not if aborted)
    if (!success && !signal?.aborted && task.retryCount < 1) {
      setBatchTasks(prev => prev.map(t =>
        t.id === task.id ? {
          ...t,
          status: 'retrying',
          retryCount: t.retryCount + 1,
          error: undefined
        } : t
      ));

      // Small delay before retry
      await new Promise(resolve => setTimeout(resolve, 500));

      if (signal?.aborted) return false;

      // Retry
      const retryTask = { ...task, retryCount: task.retryCount + 1 };
      success = await processBatchTask(retryTask, signal);
    }

    return success;
  };

  const handleStartBatchProcessing = async () => {
    if (batchTasks.length === 0) {
      showToast('请先添加文件', 'error');
      return;
    }
    
    if (modelStatus !== 'ready') {
      showToast('请先等待模型加载完成', 'error');
      return;
    }
    
    setIsBatchProcessing(true);
    abortBatchRef.current = false;
    batchAbortControllerRef.current = new AbortController();
    batchStartTimeRef.current = Date.now();
    setEtaTick(0);
    const signal = batchAbortControllerRef.current.signal;

    // Reset all pending/error tasks to pending
    setBatchTasks(prev => prev.map(t =>
      t.status === 'error' || t.status === 'retrying'
        ? { ...t, status: 'pending', progress: 0, error: undefined }
        : t.status === 'success' ? t : { ...t, status: 'pending' }
    ));

    // Get pending tasks
    const pendingTasks = batchTasks.filter(t => t.status === 'pending' || t.status === 'error');

    // Process with concurrency control
    const executing: Promise<void>[] = [];
    let completed = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const task of pendingTasks) {
      if (abortBatchRef.current || signal.aborted) break;

      const promise = (async () => {
        const success = await processBatchWithRetry(task, signal);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
        completed++;
      })();

      executing.push(promise);

      if (executing.length >= batchConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);

    setIsBatchProcessing(false);
    batchAbortControllerRef.current = null;

    if (signal.aborted) {
      showToast(`已取消: ${successCount} 已完成`, 'info');
    } else {
      showToast(`处理完成: ${successCount} 成功, ${errorCount} 失败`, successCount > 0 ? 'success' : 'error');
    }
  };

  const handleStopBatchProcessing = () => {
    abortBatchRef.current = true;
    // 立即中止所有正在进行的 fetch,而不是等当前一批跑完
    batchAbortControllerRef.current?.abort();
    showToast('正在取消...', 'info');
  };

  const handleBatchExport = async () => {
    const successTasks = batchTasks.filter(t => t.status === 'success' && t.processedImage);
    
    if (successTasks.length === 0) {
      showToast('没有可导出的图片', 'error');
      return;
    }
    
    try {
      // Use Electron's dialog to select output directory
      const result = await selectFolder();
      if (!result || result.canceled) return;
      
      const outputDir = result.filePaths[0];
      setBatchOutputDir(outputDir);
      let exported = 0;
      
      for (const task of successTasks) {
        try {
          const isGifTask = task.fileName.toLowerCase().endsWith('.gif');
          const ext = isGifTask ? 'gif' : formatExt(outputFormat);
          const baseName = task.fileName.replace(/\.[^/.]+$/, '');
          const outputName = `${batchPrefix}${baseName}.${ext}`;
          const outputPath = `${outputDir}/${outputName}`;

          // 把 blob URL 还原成 data URL(单图导出与批量导出共用同一套格式/裁切处理)
          let dataUrl: string;
          if (task.processedImage!.startsWith('blob:')) {
            const response = await fetch(task.processedImage!);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);
            dataUrl = `data:image/${isGifTask ? 'gif' : 'png'};base64,${base64}`;
          } else {
            dataUrl = task.processedImage!;
          }

          // 非 GIF 才按用户的 outputFormat / autoCrop 应用
          if (!isGifTask) {
            if (autoCrop) dataUrl = await cropToContent(dataUrl);
            if (outputFormat !== 'png') dataUrl = await convertImageFormat(dataUrl, outputFormat);
          }

          await saveImageToPath(dataUrl, outputPath);
          exported++;
        } catch (err) {
          console.error('Export failed for task:', task.id, err);
        }
      }
      
      showToast(`导出完成: ${exported}/${successTasks.length}`, exported > 0 ? 'success' : 'error');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('导出失败', 'error');
    }
  };

  const handleRetryTask = async (taskId: string) => {
    const task = batchTasks.find(t => t.id === taskId);
    if (!task || isBatchProcessing) return;
    
    setBatchTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'pending', progress: 0, error: undefined } : t
    ));
    
    await processBatchWithRetry(task);
  };

  const handleBatchDialogClose = () => {
    if (isBatchProcessing) {
      showToast('请先停止处理再关闭窗口', 'error');
      return;
    }
    setShowBatchDialog(false);
    // Clean up blob URLs
    batchTasks.forEach(task => {
      if (task.processedImage && task.processedImage.startsWith('blob:')) {
        URL.revokeObjectURL(task.processedImage);
      }
    });
    setBatchTasks([]);
  };

  const handleSave = async () => {
    if (!processedImage) return;

    try {
      let imageData = processedImage;
      let defaultName: string;

      if (isOriginalGif) {
        // GIF 保持 GIF 格式(不能直接转其它静态格式)
        defaultName = 'removed_bg.gif';
        if (processedImage.startsWith('blob:')) {
          showToast('正在准备导出...', 'info');
          const response = await fetch(processedImage);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          imageData = `data:image/gif;base64,${base64}`;
        }
      } else {
        // 普通图片:可选先智能裁切去透明边,再按用户选的格式转换
        defaultName = `removed_bg.${formatExt(outputFormat)}`;
        if (autoCrop) imageData = await cropToContent(imageData);
        if (outputFormat !== 'png') imageData = await convertImageFormat(imageData, outputFormat);
      }

      const result = await saveImage(imageData, defaultName);
      if (result) {
        showToast('图片已导出', 'success');
      }
    } catch (e) {
      console.error('Failed to save image:', e);
      showToast('导出失败: ' + (e as Error).message, 'error');
    }
  };

  // 整个窗口接受图片拖入(而非仅 drop-zone)。
  // document 级监听同时拦截浏览器默认行为(否则 drop 到非 drop-zone 区域会触发文件导航)。
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setDragActive(true);
    };
    const onDragLeave = (e: DragEvent) => {
      // 鼠标真正离开窗口才取消,避免在子元素之间移动时闪烁
      if (e.relatedTarget === null || (e as any).fromElement === null) {
        setDragActive(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const allFiles = Array.from(e.dataTransfer?.files || []);
      const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      if (imageFiles.length === 1) {
        // 单文件:走单图流程
        const file = imageFiles[0];
        if (originalImage || processedImage) {
          setPendingFile(file);
          setShowPasteConfirm(true);
        } else {
          loadFileImage(file);
        }
      } else {
        // 多文件:自动加入批量并打开批量对话框(批量不支持 GIF,过滤掉)
        const validFiles = imageFiles.filter(f => {
          const isGif = f.type === 'image/gif' || f.name.toLowerCase().endsWith('.gif');
          if (isGif) showToast(`已跳过 GIF: ${f.name}`, 'info');
          return !isGif;
        });
        if (validFiles.length === 0) {
          showToast('拖入的图片均为 GIF 格式(批量不支持)', 'error');
          return;
        }
        const newTasks: BatchTask[] = validFiles.map(f => ({
          id: Math.random().toString(36).substr(2, 9),
          file: f,
          fileName: f.name,
          status: 'pending',
          progress: 0,
          retryCount: 0,
        }));
        setBatchTasks(prev => [...prev, ...newTasks]);
        setShowBatchDialog(true);
        showToast(`已添加 ${validFiles.length} 张到批量`, 'success');
      }
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [originalImage, processedImage]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!originalImage && !processedImage) return;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startTranslateRef.current = { x: translateXRef.current, y: translateYRef.current };
  }, [originalImage, processedImage]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 主预览拖动:用 window 级监听,即使鼠标拖出 panel 边界也能继续到松手再结束
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const newTx = startTranslateRef.current.x + (e.clientX - startPosRef.current.x);
      const newTy = startTranslateRef.current.y + (e.clientY - startPosRef.current.y);
      updateTransform(scaleRef.current, newTx, newTy);
      setTranslateX(newTx);
      setTranslateY(newTy);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleImageLoad = () => {
    // Image loaded callback - ensure transform is applied after image loads
    // This handles cases where the image loads before refs are ready
    if (originalTransformRef.current && scaleRef.current) {
      const transform = `translate(calc(-50% + ${translateXRef.current}px), calc(-50% + ${translateYRef.current}px)) scale(${scaleRef.current})`;
      originalTransformRef.current.style.transform = transform;
    }
    if (resultTransformRef.current && scaleRef.current) {
      const transform = `translate(calc(-50% + ${translateXRef.current}px), calc(-50% + ${translateYRef.current}px)) scale(${scaleRef.current})`;
      resultTransformRef.current.style.transform = transform;
    }
  };

  // Initialize canvases when processed image changes
  useEffect(() => {
    if (processedImage && outputCanvasRef.current && maskCanvasRef.current && originalImage && processedCanvasRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const outputCanvas = outputCanvasRef.current!;
        const processedCanvas = processedCanvasRef.current!;
        const maskCanvas = maskCanvasRef.current!;
        const originalCanvas = originalCanvasRef.current!;

        const width = img.naturalWidth;
        const height = img.naturalHeight;

        outputCanvas.width = width;
        outputCanvas.height = height;
        processedCanvas.width = width;
        processedCanvas.height = height;
        maskCanvas.width = width;
        maskCanvas.height = height;
        originalCanvas.width = width;
        originalCanvas.height = height;

        // Draw processed image to processedCanvas (store AI result)
        const processedCtx = processedCanvas.getContext('2d', { willReadFrequently: true });
        if (processedCtx) {
          processedCtx.clearRect(0, 0, width, height);
          processedCtx.drawImage(img, 0, 0);
        }

        // Initialize mask with gray (128 = show AI processed)
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        if (maskCtx) {
          maskCtx.fillStyle = 'rgb(128, 128, 128)';
          maskCtx.fillRect(0, 0, width, height);
        }

        // Load original image
        const originalImg = new Image();
        originalImg.crossOrigin = 'anonymous';
        originalImg.onload = () => {
          const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
          if (originalCtx) {
            originalCtx.clearRect(0, 0, width, height);
            originalCtx.drawImage(originalImg, 0, 0);
          }
          // Initial render
          applyMaskToOutput();
        };
        originalImg.src = originalImage;

        // Reset history
        setMaskHistory([]);
        setHistoryIndex(-1);

        // Save initial state
        setTimeout(() => {
          if (maskCanvasRef.current) {
            const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              const imageData = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
              setMaskHistory([imageData]);
              setHistoryIndex(0);
            }
          }
        }, 0);
      };
      img.src = processedImage;
    }
  }, [processedImage, originalImage]);

  // Close bg picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bgPickerRef.current && !bgPickerRef.current.contains(event.target as Node)) {
        setShowBgPicker(false);
      }
    };

    if (showBgPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showBgPicker]);

  // Close zoom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (zoomControlRef.current && !zoomControlRef.current.contains(event.target as Node)) {
        setShowZoomDropdown(false);
      }
    };

    if (showZoomDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showZoomDropdown]);

  // Toast helper function
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type, visible: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + O: Open image
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleSelectImage();
      }
      // Ctrl/Cmd + S: Save/Export
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (processedImage) {
          handleSaveWithMask();
        }
      }
      // Ctrl/Cmd + C: Copy to clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
        e.preventDefault();
        if (processedImage) {
          if (isOriginalGif) {
            showToast('GIF 格式不支持复制到剪贴板，请使用导出功能', 'info');
          } else {
            handleCopyToClipboard();
          }
        }
      }
      // Ctrl/Cmd + P: Process image
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (originalImage && !isProcessing) {
          handleProcess();
        }
      }
      // Ctrl/Cmd + Z: Undo, Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          if (historyIndex < maskHistory.length - 1) handleRedo();
        } else {
          if (historyIndex > 0) handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (historyIndex < maskHistory.length - 1) handleRedo();
      }
      // Ctrl/Cmd + B: Toggle background picker
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (processedImage) {
          setShowBgPicker(!showBgPicker);
        }
      }
      // ?: Show shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowModelSelector(false);
        setShowHelp(false);
        setShowBgPicker(false);
        setShowShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [originalImage, processedImage, isProcessing, historyIndex, maskHistory.length, showBgPicker]);

  // Handle paste image
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string;
              if (originalImage || processedImage) {
                // Show confirmation if there's already an image
                setPendingImageUrl(imageUrl);
                setShowPasteConfirm(true);
              } else {
                // Load directly if no image exists
                loadImageWithFit(imageUrl);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [originalImage, processedImage]);

  // Helper function to load image with auto-fit
  const loadImageWithFit = (imageUrl: string) => {
    // Exit edit mode if currently in erase or restore mode
    if (editMode !== 'none') {
      setEditMode('none');
    }
    
    setOriginalImage(imageUrl);
    setProcessedImage(null);
    
    // Clear previous processed frames when loading any new image
    setGifProcessedFrames([]);
    
    // Clear previous GIF frames if not a GIF
    if (!imageUrl.startsWith('data:image/gif')) {
      setIsOriginalGif(false);
      setGifOriginalFrames([]);
    } else {
      // Extract GIF frames immediately when loading a GIF
      setIsOriginalGif(true);
      extractGifFrames(imageUrl);
    }
    
    // Auto-fit image to panel
    const img = new Image();
    img.onload = () => {
      const panel = originalPanelRef.current;
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      
      let finalScale = 1;
      
      if (panel && panel.clientWidth > 0 && panel.clientHeight > 0) {
        const panelW = panel.clientWidth;
        const panelH = panel.clientHeight;
        
        // Calculate scale to fit image to panel (cover mode)
        const scaleX = (panelW - 40) / imgW;
        const scaleY = (panelH - 40) / imgH;
        const newScale = Math.max(scaleX, scaleY);
        
        finalScale = Math.min(newScale, 1);
      } else {
        // Fallback: calculate scale based on a reasonable default panel size
        // or use 1 if image is smaller than typical panel
        const defaultPanelW = 800;
        const defaultPanelH = 600;
        const scaleX = (defaultPanelW - 40) / imgW;
        const scaleY = (defaultPanelH - 40) / imgH;
        finalScale = Math.min(Math.max(scaleX, scaleY), 1);
      }
      
      setScale(finalScale);
      setTranslateX(0);
      setTranslateY(0);
      updateTransform(finalScale, 0, 0);
      
      showToast('图片已加载，准备开始AI抠图', 'success');
    };
    img.src = imageUrl;
  };
  
  // Extract GIF frames for display
  const extractGifFrames = async (imageUrl: string) => {
    try {
      // Convert data URL to ArrayBuffer
      const base64Data = imageUrl.split(',')[1];
      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const gifReader = new GifReader(bytes);
      const numFrames = gifReader.numFrames();
      const width = gifReader.width;
      const height = gifReader.height;
      
      const frameUrls: string[] = [];
      
      for (let i = 0; i < numFrames; i++) {
        const frameInfo = gifReader.frameInfo(i);
        const pixels = new Uint8Array(width * height * 4);
        gifReader.decodeAndBlitFrameRGBA(i, pixels);
        
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext('2d');
        if (frameCtx) {
          const imageData = frameCtx.createImageData(width, height);
          imageData.data.set(pixels);
          frameCtx.putImageData(imageData, 0, 0);
          frameUrls.push(frameCanvas.toDataURL('image/png'));
        }
      }
      
      setGifOriginalFrames(frameUrls);
    } catch (error) {
      console.error('Failed to extract GIF frames:', error);
    }
  };

  // Confirm paste and replace
  const confirmPaste = () => {
    if (pendingImageUrl) {
      loadImageWithFit(pendingImageUrl);
      setPendingImageUrl(null);
    } else if (pendingFile) {
      loadFileImage(pendingFile);
      setPendingFile(null);
    }
    setShowPasteConfirm(false);
  };

  // Cancel paste
  const cancelPaste = () => {
    setPendingImageUrl(null);
    setPendingFile(null);
    setShowPasteConfirm(false);
  };

  // Save mask state
  const saveMaskState = () => {
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        setMaskHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(imageData);
          return newHistory.slice(-100);
        });
        setHistoryIndex(prev => Math.min(prev + 1, 99));
      }
    }
  };

  // Apply mask to output - must be defined before handleUndo
  const applyMaskToOutput = () => {
    if (!outputCanvasRef.current || !maskCanvasRef.current || !originalCanvasRef.current || !processedCanvasRef.current) return;

    const outputCanvas = outputCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const processedCanvas = processedCanvasRef.current;

    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    const processedCtx = processedCanvas.getContext('2d', { willReadFrequently: true });

    if (!outputCtx || !maskCtx || !originalCtx || !processedCtx) return;

    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const originalData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const processedData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
    const outputData = outputCtx.createImageData(outputCanvas.width, outputCanvas.height);

    for (let i = 0; i < maskData.data.length; i += 4) {
      const maskValue = maskData.data[i];
      let r = processedData.data[i];
      let g = processedData.data[i + 1];
      let b = processedData.data[i + 2];
      let a = processedData.data[i + 3];

      if (maskValue < 128) {
        // Erase region: interpolate between transparent (mask=0) and processed (mask=128)
        const factor = maskValue / 128; // 0 to 1
        r = processedData.data[i] * factor;
        g = processedData.data[i + 1] * factor;
        b = processedData.data[i + 2] * factor;
        a = processedData.data[i + 3] * factor;
      } else if (maskValue > 128) {
        // Restore region: interpolate between processed (mask=128) and original (mask=255)
        const factor = (maskValue - 128) / 127; // 0 to 1
        r = processedData.data[i] * (1 - factor) + originalData.data[i] * factor;
        g = processedData.data[i + 1] * (1 - factor) + originalData.data[i + 1] * factor;
        b = processedData.data[i + 2] * (1 - factor) + originalData.data[i + 2] * factor;
        a = processedData.data[i + 3] * (1 - factor) + originalData.data[i + 3] * factor;
      }
      // maskValue == 128: use processed as-is

      outputData.data[i] = r;
      outputData.data[i + 1] = g;
      outputData.data[i + 2] = b;
      outputData.data[i + 3] = a;
    }

    outputCtx.putImageData(outputData, 0, 0);
  };

  // Undo
  const handleUndo = () => {
    if (historyIndex > 0 && maskCanvasRef.current) {
      const newIndex = historyIndex - 1;
      const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx && maskHistory[newIndex]) {
        ctx.putImageData(maskHistory[newIndex], 0, 0);
        setHistoryIndex(newIndex);
        applyMaskToOutput();
      }
    }
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex < maskHistory.length - 1 && maskCanvasRef.current) {
      const newIndex = historyIndex + 1;
      const ctx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx && maskHistory[newIndex]) {
        ctx.putImageData(maskHistory[newIndex], 0, 0);
        setHistoryIndex(newIndex);
        applyMaskToOutput();
      }
    }
  };

  // Drawing functions
  const handleDrawStart = (e: React.MouseEvent) => {
    if (editMode === 'none' || !maskCanvasRef.current || !outputCanvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDrawing(true);
    const rect = outputCanvasRef.current.getBoundingClientRect();
    const scaleX = outputCanvasRef.current.width / rect.width;
    const scaleY = outputCanvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    lastPosRef.current = { x, y };
    drawOnMask(x, y);
  };

  const handleDrawMove = (e: React.MouseEvent) => {
    if (editMode === 'none' || !isDrawing || !outputCanvasRef.current || !maskCanvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = outputCanvasRef.current.getBoundingClientRect();
    const scaleX = outputCanvasRef.current.width / rect.width;
    const scaleY = outputCanvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (lastPosRef.current) {
      drawLineOnMask(lastPosRef.current, { x, y });
    }

    lastPosRef.current = { x, y };
  };

  const handleDrawEnd = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPosRef.current = null;
      saveMaskState();
    }
  };

  // Original panel drag handlers for edit mode
  const handleOriginalMouseDown = (e: React.MouseEvent) => {
    if (editMode === 'none' || !originalImage) return;
    e.preventDefault();
    e.stopPropagation();
    setIsOriginalDragging(true);
    setOriginalStartPos({ x: e.clientX, y: e.clientY });
    setOriginalStartTranslate({ x: translateXRef.current, y: translateYRef.current });
  };

  const handleOriginalMouseMove = (e: React.MouseEvent) => {
    if (!isOriginalDragging) return;
    const newTx = originalStartTranslate.x + (e.clientX - originalStartPos.x);
    const newTy = originalStartTranslate.y + (e.clientY - originalStartPos.y);
    updateTransform(scaleRef.current, newTx, newTy);
    setTranslateX(newTx);
    setTranslateY(newTy);
  };

  const handleOriginalMouseUp = () => {
    setIsOriginalDragging(false);
  };

  const drawOnMask = (x: number, y: number) => {
    if (!outputCanvasRef.current || !originalCanvasRef.current) return;

    const outputCanvas = outputCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!outputCtx) return;

    const radius = brushSize / 2;
    
    if (editMode === 'erase') {
      // Erase mode: use destination-out to create transparent hole
      outputCtx.save();
      const gradient = outputCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(0.85, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      outputCtx.fillStyle = gradient;
      outputCtx.globalCompositeOperation = 'destination-out';
      outputCtx.beginPath();
      outputCtx.arc(x, y, radius, 0, Math.PI * 2);
      outputCtx.fill();
      outputCtx.restore();
    } else {
      // Restore mode: draw original image with circular mask
      outputCtx.save();
      // Create circular clipping path
      outputCtx.beginPath();
      outputCtx.arc(x, y, radius, 0, Math.PI * 2);
      outputCtx.clip();
      // Draw original image
      outputCtx.drawImage(originalCanvas, 0, 0);
      outputCtx.restore();
    }
    
    // Also record in mask canvas for history
    if (maskCanvasRef.current) {
      const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (maskCtx) {
        maskCtx.beginPath();
        maskCtx.arc(x, y, radius, 0, Math.PI * 2);
        maskCtx.fillStyle = editMode === 'erase' ? 'black' : 'white';
        maskCtx.fill();
      }
    }
  };

  const drawLineOnMask = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (!outputCanvasRef.current || !originalCanvasRef.current) return;

    const outputCanvas = outputCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!outputCtx) return;

    const radius = brushSize / 2;
    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    const steps = Math.max(1, Math.ceil(distance / (radius / 3)));

    if (editMode === 'erase') {
      outputCtx.save();
      outputCtx.globalCompositeOperation = 'destination-out';
      
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        
        const gradient = outputCtx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.85, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        outputCtx.fillStyle = gradient;
        outputCtx.beginPath();
        outputCtx.arc(x, y, radius, 0, Math.PI * 2);
        outputCtx.fill();
      }
      
      outputCtx.restore();
    } else {
      // Restore mode: draw original image along the line
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        
        outputCtx.save();
        outputCtx.beginPath();
        outputCtx.arc(x, y, radius, 0, Math.PI * 2);
        outputCtx.clip();
        outputCtx.drawImage(originalCanvas, 0, 0);
        outputCtx.restore();
      }
    }
    
    // Record in mask canvas
    if (maskCanvasRef.current) {
      const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (maskCtx) {
        maskCtx.fillStyle = editMode === 'erase' ? 'black' : 'white';
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t;
          maskCtx.beginPath();
          maskCtx.arc(x, y, radius, 0, Math.PI * 2);
          maskCtx.fill();
        }
      }
    }
  };

  // Compose image with background
  const composeImageWithBackground = async (): Promise<HTMLCanvasElement | null> => {
    if (!outputCanvasRef.current) return null;
    
    const outputCanvas = outputCanvasRef.current;
    const width = outputCanvas.width;
    const height = outputCanvas.height;
    
    // Create a new canvas for composition
    const composedCanvas = document.createElement('canvas');
    composedCanvas.width = width;
    composedCanvas.height = height;
    const ctx = composedCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    
    // Draw background
    if (bgImage) {
      // Draw background image with CSS cover mode
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        bgImg.onload = () => {
          // Calculate cover mode dimensions (same as CSS background-size: cover)
          const imgRatio = bgImg.width / bgImg.height;
          const canvasRatio = width / height;
          
          let drawWidth, drawHeight, offsetX, offsetY;
          
          if (imgRatio > canvasRatio) {
            // Image is wider than canvas (relative to height)
            drawHeight = height;
            drawWidth = height * imgRatio;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
          } else {
            // Image is taller than canvas (relative to width)
            drawWidth = width;
            drawHeight = width / imgRatio;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
          }
          
          ctx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);
          resolve();
        };
        bgImg.onerror = () => resolve();
        bgImg.src = bgImage;
      });
    } else if (bgColor !== 'transparent') {
      // Draw background color
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    
    // Draw foreground (output canvas with transparent background)
    ctx.drawImage(outputCanvas, 0, 0);
    
    return composedCanvas;
  };

  // Compose GIF with background
  const composeGifWithBackground = async (): Promise<Blob | null> => {
    if (!processedImage || !isOriginalGif) return null;
    
    try {
      const response = await fetch(processedImage);
      const gifBuffer = await response.arrayBuffer();
      
      const gifReader = new GifReader(new Uint8Array(gifBuffer));
      const numFrames = gifReader.numFrames();
      const width = gifReader.width;
      const height = gifReader.height;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      
      const estimatedSize = width * height * numFrames * 4 + 10 * 1024 * 1024;
      const outputBuffer = new Uint8Array(estimatedSize);
      const gifWriter = new GifWriter(outputBuffer, width, height, { loop: 0 });
      
      // Load background image if set
      let bgImg: HTMLImageElement | null = null;
      if (bgImage) {
        bgImg = new Image();
        await new Promise<void>((resolve, reject) => {
          bgImg!.onload = () => resolve();
          bgImg!.onerror = reject;
          bgImg!.src = bgImage;
        });
      }
      
      // Process each frame
      for (let i = 0; i < numFrames; i++) {
        const frameInfo = gifReader.frameInfo(i);
        const pixels = new Uint8Array(width * height * 4);
        gifReader.decodeAndBlitFrameRGBA(i, pixels);
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw background
        if (bgImg) {
          const imgRatio = bgImg.width / bgImg.height;
          const canvasRatio = width / height;
          let drawWidth, drawHeight, offsetX, offsetY;
          
          if (imgRatio > canvasRatio) {
            drawHeight = height;
            drawWidth = height * imgRatio;
            offsetX = (width - drawWidth) / 2;
            offsetY = 0;
          } else {
            drawWidth = width;
            drawHeight = width / imgRatio;
            offsetX = 0;
            offsetY = (height - drawHeight) / 2;
          }
          ctx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);
        } else if (bgColor !== 'transparent') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, width, height);
        }
        
        // Draw frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          const imageData = tempCtx.createImageData(width, height);
          imageData.data.set(pixels);
          tempCtx.putImageData(imageData, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0);
        }
        
        // Get composed data
        const composedData = ctx.getImageData(0, 0, width, height);
        const composedPixels = new Uint8Array(composedData.data);
        const { palette, indices, transparentIndex } = createPalette(composedPixels);
        
        // Convert palette
        const paletteForOmggif: number[] = [];
        for (let j = 0; j < palette.length; j += 3) {
          const r = palette[j], g = palette[j + 1], b = palette[j + 2];
          paletteForOmggif.push((r << 16) | (g << 8) | b);
        }
        
        const addFrameOpts: any = { 
          delay: frameInfo.delay, 
          palette: paletteForOmggif,
          disposal: 2  // 2 = Restore to background color (transparent)
        };
        if (transparentIndex !== null) addFrameOpts.transparent = transparentIndex;
        
        gifWriter.addFrame(0, 0, width, height, indices, addFrameOpts);
      }
      
      const gifLength = gifWriter.end();
      return new Blob([outputBuffer.slice(0, gifLength)], { type: 'image/gif' });
    } catch (err) {
      console.error('GIF composition failed:', err);
      return null;
    }
  };

  const handleSaveWithMask = async () => {
    // Check if it's a GIF
    if (isOriginalGif && processedImage) {
      // Check if background should be applied
      if (bgImage || bgColor !== 'transparent') {
        showToast('正在合成背景...', 'info');
        const composedBlob = await composeGifWithBackground();
        if (composedBlob) {
          // 将 blob 转换为 base64（使用分块避免栈溢出）
          const arrayBuffer = await composedBlob.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const imageData = `data:image/gif;base64,${base64}`;
          const result = await saveImage(imageData, 'removed_bg_edited.gif');
          if (result) {
            showToast('GIF 已导出', 'success');
          }
          // If result is null, user cancelled - no message needed
        } else {
          showToast('GIF 合成失败', 'error');
        }
      } else {
        // No background, export as-is - 需要获取 blob 数据并转换为 base64
        showToast('正在准备导出...', 'info');
        const response = await fetch(processedImage);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const imageData = `data:image/gif;base64,${base64}`;
        const result = await saveImage(imageData, 'removed_bg.gif');
        if (result) {
          showToast('GIF 已导出', 'success');
        }
        // If result is null, user cancelled - no message needed
      }
      return;
    }
    
    const composedCanvas = await composeImageWithBackground();
    if (!composedCanvas) return;

    // 智能裁切:如果用户开启 + 当前是透明背景,先裁掉透明边;
    // 若有底色/底图,合成后无透明像素,裁切不会触发(cropToContent 返回原图)
    let dataUrl = composedCanvas.toDataURL('image/png');
    if (autoCrop) dataUrl = await cropToContent(dataUrl);

    // 按输出格式转换(jpg 内部会铺白底,webp/png 保留透明)
    if (outputFormat !== 'png') dataUrl = await convertImageFormat(dataUrl, outputFormat);

    const result = await saveImage(dataUrl, `removed_bg_edited.${formatExt(outputFormat)}`);
    if (result) {
      showToast('图片已导出', 'success');
    }
    // If result is null, user cancelled - no message needed
  };

  const handleCopyToClipboard = async () => {
    if (!processedImage) return;
    
    try {
      let imageBlob: Blob;
      
      // If it's a GIF, compose with background
      if (isOriginalGif) {
        if (bgImage || bgColor !== 'transparent') {
          showToast('正在合成背景...', 'info');
          const composedBlob = await composeGifWithBackground();
          if (!composedBlob) {
            showToast('合成失败', 'error');
            return;
          }
          imageBlob = composedBlob;
        } else {
          // No background, use processed GIF as-is
          const response = await fetch(processedImage);
          imageBlob = await response.blob();
        }
      } else if (bgImage || bgColor !== 'transparent') {
        // Compose image with background (same as export)
        const composedCanvas = await composeImageWithBackground();
        if (!composedCanvas) {
          showToast('合成失败', 'error');
          return;
        }
        imageBlob = await new Promise<Blob>((resolve, reject) => {
          composedCanvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert canvas to blob'));
          }, 'image/png');
        });
      } else if (outputCanvasRef.current) {
        // Use current output canvas (includes erase/restore edits)
        imageBlob = await new Promise<Blob>((resolve, reject) => {
          outputCanvasRef.current!.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert canvas to blob'));
          }, 'image/png');
        });
      } else {
        // Fallback: use processed image as-is
        const response = await fetch(processedImage);
        imageBlob = await response.blob();
      }
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(imageBlob);
      const base64Data = await base64Promise;
      
      // Use Electron backend to copy to clipboard
      await copyImageToClipboard(base64Data);
      showToast('已复制到剪贴板', 'success');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      showToast('复制失败', 'error');
    }
  };

  return (
    <div className="app">
      {/* 拖拽文件到窗口任意位置时全屏高亮提示(配合 document 级 drop 监听) */}
      {dragActive && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            <div className="drop-overlay-icon">📥</div>
            <div className="drop-overlay-text">释放鼠标加载图片</div>
            <div className="drop-overlay-hint">支持 PNG / JPG / WebP / GIF</div>
          </div>
        </div>
      )}
      <TitleBar
        currentModel={currentModel}
        modelStatus={modelStatus}
        onShowModelSelector={() => setShowModelSelector(true)}
        onShowHelp={() => setShowHelp(true)}
      />
      {showModelSelector && (
        <div className="modal-overlay" onClick={() => setShowModelSelector(false)}>
          <div className="modal model-selector-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>选择 AI 模型</h3>
              <button className="modal-close" onClick={() => setShowModelSelector(false)}>×</button>
            </div>
            <div className="modal-content">
              {availableModels.length === 0 && (
                <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                  <p>暂无可用模型</p>
                </div>
              )}
              <div className="model-list">
                {availableModels.map((m) => {
                  // Determine model status - use path for comparison (more reliable)
                  const isLoaded = currentModel?.path === m.path || currentModel?.name === m.name;
                  const isLoading = loadingModelId === m.id;
                  const isError = errorModelId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`model-item ${isLoaded ? 'loaded' : ''} ${isLoading ? 'loading' : ''} ${isError ? 'error' : ''} ${!m.exists ? 'missing' : ''}`}
                    >
                      <div className="model-info">
                        <div className="model-name-wrapper">
                          <span className="model-name">{m.display_name}</span>
                          {/* Status indicator dot */}
                          {isLoaded && (
                            <span className="model-status-indicator loaded" title="当前已加载">
                              <span className="indicator-dot" />
                              <span className="indicator-pulse" />
                            </span>
                          )}
                          {isLoading && (
                            <span className="model-status-indicator loading" title="加载中...">
                              <span className="indicator-spinner" />
                            </span>
                          )}
                          {isError && (
                            <span className="model-status-indicator error" title="加载失败">
                              <span className="indicator-dot" />
                            </span>
                          )}
                          {!m.exists && !isLoaded && !isLoading && !isError && (
                            <span className="model-status-indicator missing" title="未下载">
                              <span className="indicator-dot" />
                            </span>
                          )}
                        </div>
                        <span className="model-type">{m.type?.toUpperCase()}</span>
                      </div>
                      <div className="model-actions">
                        {/* 显示模型大小 */}
                        <span className="model-size">{m.size_mb > 0 ? `${m.size_mb} MB` : '未下载'}</span>

                        {m.exists ? (
                          /* 模型存在时显示加载状态 */
                          <>
                            {isLoaded ? (
                              <span className="model-status-badge loaded">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                已加载
                              </span>
                            ) : isLoading ? (
                              <span className="model-status-badge loading">
                                <span className="badge-spinner" />
                                加载中...
                              </span>
                            ) : isError ? (
                              <span className="model-status-badge error">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                                失败
                              </span>
                            ) : (
                              <button className="btn btn-small" onClick={() => handleLoadFixedModel(m.id)}>
                                加载
                              </button>
                            )}
                            {/* 重选文件按钮 - 对已加载模型也显示 */}
                            {isLoaded && (
                              <button 
                                className="btn btn-small btn-outline" 
                                onClick={() => selectCustomModel(m.id)}
                                title="重新选择模型文件"
                              >
                                重选
                              </button>
                            )}
                            {/* 仅对非内置模型显示下载按钮(1.4 已随安装包内置) */}
                            {m.download_url && !isLoaded && m.id !== '1.4' && (
                              <button
                                className="btn btn-small btn-link"
                                onClick={() => handleDownloadModel(m.download_url!, m.name, m.display_name || m.name)}
                              >
                                下载
                              </button>
                            )}
                          </>
                        ) : (
                          /* 模型不存在时显示选择和下载 */
                          <>
                            {isLoading ? (
                              <span className="model-status-badge loading">
                                <span className="badge-spinner" />
                                加载中...
                              </span>
                            ) : isError ? (
                              <span className="model-status-badge error">加载失败</span>
                            ) : (
                              <button className="btn btn-small" onClick={() => selectCustomModel(m.id)}>
                                选择文件
                              </button>
                            )}
                            {m.download_url && m.id !== '1.4' && (
                              <button
                                className="btn btn-small btn-link"
                                onClick={() => handleDownloadModel(m.download_url!, m.name, m.display_name || m.name)}
                              >
                                下载
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {isLoadingModel && <div className="modal-loading">加载模型中...</div>}
          </div>
        </div>
      )}

      {/* Update Dialog */}
      {showUpdateDialog && updateInfo && (
        <div className="modal-overlay" onClick={handleUpdateDismiss}>
          <div className="modal update-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎉 发现新版本</h3>
              <button className="modal-close" onClick={handleUpdateDismiss}>×</button>
            </div>
            <div className="modal-content">
              <div className="update-info">
                <div className="version-comparison">
                  <div className="version-item current">
                    <span className="version-label">当前版本</span>
                    <span className="version-number">v{updateInfo.currentVersion}</span>
                  </div>
                  <div className="version-arrow">→</div>
                  <div className="version-item latest">
                    <span className="version-label">最新版本</span>
                    <span className="version-number">v{updateInfo.latestVersion}</span>
                  </div>
                </div>
                <div className="update-message">
                  <p>检测到新版本可用！建议更新以获得更好的体验。</p>
                </div>
                {updateInfo.releaseNotes && (
                  <div className="update-notes">
                    <h4>更新内容：</h4>
                    <div 
                      className="release-notes-content"
                      dangerouslySetInnerHTML={{ 
                        __html: updateInfo.releaseNotes
                          .replace(/#{1,6}\s(.+)/g, '<h4>$1</h4>')
                          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                          .replace(/- (.+)/g, '• $1')
                          .replace(/\n/g, '<br/>')
                          .substring(0, 2000)
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="update-actions">
                <button className="btn btn-secondary" onClick={handleUpdateDismiss}>
                  稍后再说
                </button>
                <button className="btn btn-primary" onClick={handleUpdateDownload}>
                  立即下载更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GIF Frame Preview Modal */}
      <GifFramePreviewModal
        isOpen={showGifFramePreview}
        onClose={() => setShowGifFramePreview(false)}
        frameIndex={selectedGifFrame}
        originalFrames={gifOriginalFrames}
        processedFrames={gifProcessedFrames}
      />

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal modal-help" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>帮助说明</h3>
              <button className="modal-close" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="modal-content help-content">
              <div className="help-intro">
                <div className="help-intro-icon">
                  <img src="./logo.png" alt="logo" />
                </div>
                <h2>小飞AI抠图 v{__APP_VERSION__}</h2>
                <p>完全本地运行的 AI 智能抠图工具，基于 Electron 构建，保护您的隐私。</p>
              </div>

              <div className="help-features">
                <div className="feature-item">
                  <div className="feature-icon">🔒</div>
                  <div className="feature-text">
                    <h4>完全离线</h4>
                    <p>所有处理均在本地完成，无需联网，保护隐私</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">⚡</div>
                  <div className="feature-text">
                    <h4>快速高效</h4>
                    <p>基于 RMBG 模型，毫秒级处理速度</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">✏️</div>
                  <div className="feature-text">
                    <h4>擦除修补</h4>
                    <p>手动擦除或修补抠图结果，精细控制</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🎨</div>
                  <div className="feature-text">
                    <h4>背景替换</h4>
                    <p>支持纯色、自定义颜色或图片背景</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🎬</div>
                  <div className="feature-text">
                    <h4>GIF 支持</h4>
                    <p>逐帧处理 GIF 动图，保留动画效果</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">⌨️</div>
                  <div className="feature-text">
                    <h4>快捷键支持</h4>
                    <p>丰富的键盘快捷键，提升工作效率</p>
                  </div>
                </div>
              </div>

              <div className="help-guide">
                <h3>快速上手</h3>
                <div className="guide-steps">
                  <div className="guide-step">
                    <div className="step-number">1</div>
                    <div className="step-content">
                      <h4>选择图片</h4>
                      <p>点击"选择"按钮或拖拽图片到窗口，支持 PNG、JPG、WebP、GIF 格式。也可使用快捷键 ⌘+O 或 Ctrl+V 粘贴图片</p>
                    </div>
                  </div>
                  <div className="guide-step">
                    <div className="step-number">2</div>
                    <div className="step-content">
                      <h4>AI 抠图</h4>
                      <p>点击"抠图"按钮或使用 ⌘+P 快捷键，AI 自动去除背景，首次加载约 1-2 秒</p>
                    </div>
                  </div>
                  <div className="guide-step">
                    <div className="step-number">3</div>
                    <div className="step-content">
                      <h4>精细编辑（可选）</h4>
                      <p>使用擦除/修补工具手动调整抠图结果，或按 ⌘+B 切换背景颜色/图片</p>
                    </div>
                  </div>
                  <div className="guide-step">
                    <div className="step-number">4</div>
                    <div className="step-content">
                      <h4>导出结果</h4>
                      <p>点击"导出"或使用 ⌘+S 保存图片，也可使用 ⌘+C 复制到剪贴板</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="help-shortcuts">
                <h3>快捷键</h3>
                <div className="shortcut-list">
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>O</kbd>
                    <span>选择图片</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>P</kbd>
                    <span>AI 抠图</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>S</kbd>
                    <span>导出图片</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>C</kbd>
                    <span>复制到剪贴板</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>V</kbd>
                    <span>粘贴图片</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>Z</kbd>
                    <span>撤回操作</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>⌘</kbd> + <kbd>B</kbd>
                    <span>切换背景</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>?</kbd>
                    <span>显示快捷键帮助</span>
                  </div>
                  <div className="shortcut-item">
                    <kbd>Esc</kbd>
                    <span>关闭弹窗</span>
                  </div>
                </div>
              </div>

              <div className="help-faq">
                <h3>常见问题</h3>
                <div className="faq-item">
                  <p className="faq-q">Q: 首次运行需要联网吗？</p>
                  <p className="faq-a">A: 不需要。软件完全本地运行，内置 RMBG-1.4 模型，无需联网即可使用。</p>
                </div>
                <div className="faq-item">
                  <p className="faq-q">Q: macOS 提示"无法验证开发者"怎么办？</p>
                  <p className="faq-a">A: 前往 系统设置 &gt; 隐私与安全，点击"仍要打开"允许运行。这是 macOS 对未签名应用的安全提示。</p>
                </div>
                <div className="faq-item">
                  <p className="faq-q">Q: 如何下载 RMBG-2.0 模型？</p>
                  <p className="faq-a">A: 点击顶部模型名称打开列表，找到 RMBG-2.0 点击"快捷下载"，下载后将 model.onnx 放到应用目录的 model_files/2.0/ 文件夹中。</p>
                </div>
                <div className="faq-item">
                  <p className="faq-q">Q: 支持哪些图片格式？</p>
                  <p className="faq-a">A: 支持 PNG、JPG/JPEG、WebP、GIF、BMP 格式。GIF 动图会逐帧处理保留动画效果。</p>
                </div>
                <div className="faq-item">
                  <p className="faq-q">Q: 处理速度慢怎么办？</p>
                  <p className="faq-a">A: 处理速度取决于电脑配置。首次加载模型需要 1-2 秒，后续处理会更快。推荐使用 M 系列芯片的 Mac 获得最佳性能。</p>
                </div>
                <div className="faq-item">
                  <p className="faq-q">Q: 复制到剪贴板失败怎么办？</p>
                  <p className="faq-a">A: 如果复制失败，可以使用"导出"功能将图片保存到本地，然后手动复制。某些应用可能不支持直接粘贴图片。</p>
                </div>
              </div>

              <div className="help-update">
                <h3>检查更新</h3>
                <p>当前版本：v{updateInfo?.currentVersion || '1.0.3'}</p>
                <button 
                  className="btn btn-primary" 
                  onClick={async () => {
                    showToast('正在检查更新...', 'info');
                    try {
                      const result = await checkForUpdates();
                      console.log('Manual update check result:', result);
                      
                      if (result.hasUpdate) {
                        setUpdateInfo(result);
                        setShowUpdateDialog(true);
                        setShowHelp(false); // 关闭帮助页面，避免遮挡更新弹窗
                        showToast('发现新版本！', 'success');
                      } else {
                        showToast('当前已是最新版本', 'success');
                      }
                    } catch (error) {
                      console.error('Failed to check for updates:', error);
                      showToast('检查更新失败，请稍后重试', 'error');
                    }
                  }}
                >
                  检查更新
                </button>
              </div>



              <div className="help-contact">
                <h3>开源地址</h3>
                <p>本项目已开源，欢迎 Star、Fork 和提交 PR：</p>
                <a 
                  className="github-link" 
                  href="https://github.com/pumf/ai-cutout" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('https://github.com/pumf/ai-cutout', '_blank');
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>github.com/pumf/ai-cutout</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing Dialog */}
      {showBatchDialog && (
        <div className="modal-overlay modal-overlay-blocking">
          <div className="modal modal-batch resizable-modal">
            <div className="modal-header">
              <h3>批量抠图</h3>
              <button className="modal-close" onClick={handleBatchDialogClose}>×</button>
            </div>
            <div className="modal-content batch-content">
              {/* Stats */}
              <div className="batch-stats">
                <div className="stat-item">
                  <span className="stat-value">{batchTasks.length}</span>
                  <span className="stat-label">总文件</span>
                </div>
                <div className="stat-item success">
                  <span className="stat-value">{batchTasks.filter(t => t.status === 'success').length}</span>
                  <span className="stat-label">成功</span>
                </div>
                <div className="stat-item error">
                  <span className="stat-value">{batchTasks.filter(t => t.status === 'error').length}</span>
                  <span className="stat-label">失败</span>
                </div>
                <div className="stat-item pending">
                  <span className="stat-value">{batchTasks.filter(t => t.status === 'pending' || t.status === 'processing').length}</span>
                  <span className="stat-label">待处理</span>
                </div>
              </div>

              {/* Progress */}
              {isBatchProcessing && (() => {
                const done = batchTasks.filter(t => t.status === 'success' || t.status === 'error').length;
                const total = batchTasks.length;
                const remaining = total - done;
                const elapsedMs = Date.now() - batchStartTimeRef.current;
                // 至少完成 1 张且仍有剩余,才显示 ETA;不够数据时只显示"计算中"
                const etaMs = (done > 0 && remaining > 0)
                  ? (elapsedMs / done) * remaining
                  : NaN;
                void etaTick; // 引用一下让每秒 tick 触发重渲染
                return (
                  <div className="batch-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${(done / total) * 100}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {done} / {total}
                      {remaining > 0 && (
                        <span className="progress-eta">
                          {' · 预计剩余 '}
                          {done === 0 ? '计算中…' : formatEta(etaMs)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}

              {/* File List */}
              <div className="batch-list">
                {batchTasks.length === 0 ? (
                  <div className="batch-empty">
                    <span className="empty-icon">📁</span>
                    <p>拖拽文件到此处或点击下方按钮添加</p>
                    <p className="empty-hint">支持 PNG、JPG、WebP 格式（不支持 GIF）</p>
                  </div>
                ) : (
                  batchTasks.map(task => (
                    <div 
                      key={task.id} 
                      className={`batch-item ${task.status} ${selectedBatchTask?.id === task.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBatchTask(task);
                        setShowBatchPreview(true);
                      }}
                      style={{ cursor: 'pointer' }}
                      title="点击查看预览"
                    >
                      <div className="item-icon">
                        {task.status === 'success' ? '✓' : 
                         task.status === 'error' ? '✗' : 
                         task.status === 'processing' ? '🔄' : 
                         task.status === 'retrying' ? '↻' : '⏳'}
                      </div>
                      <div className="item-info">
                        <span className="item-name" title={task.fileName}>{task.fileName}</span>
                        {task.error && <span className="item-error">{task.error}</span>}
                        {task.retryCount > 0 && <span className="item-retry">已重试 {task.retryCount} 次</span>}
                      </div>
                      <div className="item-progress">
                        {task.status === 'processing' && (
                          <>
                            <div className="progress-ring">
                              <svg viewBox="0 0 36 36">
                                <path
                                  className="progress-ring-bg"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                  className="progress-ring-fill"
                                  strokeDasharray={`${task.progress}, 100`}
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                              </svg>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="item-actions" onClick={e => e.stopPropagation()}>
                        {task.status === 'error' && !isBatchProcessing && (
                          <button 
                            className="btn-icon" 
                            onClick={() => handleRetryTask(task.id)}
                            title="重试"
                          >
                            ↻
                          </button>
                        )}
                        {!isBatchProcessing && (
                          <button 
                            className="btn-icon" 
                            onClick={() => handleRemoveBatchTask(task.id)}
                            title="删除"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Settings */}
              <div className="batch-settings">
                <div className="setting-item">
                  <label>并发数:</label>
                  <select 
                    value={batchConcurrency} 
                    onChange={(e) => setBatchConcurrency(Number(e.target.value))}
                    disabled={isBatchProcessing}
                  >
                    <option value={1}>1 (稳定)</option>
                    <option value={2}>2 (推荐)</option>
                    <option value={3}>3 (快速)</option>
                    <option value={4}>4 (高性能)</option>
                  </select>
                </div>
                <div className="setting-item">
                  <label>文件名前缀:</label>
                  <input 
                    type="text" 
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    placeholder="removed_bg_"
                    disabled={isBatchProcessing}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="batch-actions">
                <div className="actions-left">
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleBatchFilesSelect}
                    disabled={isBatchProcessing}
                  >
                    <span className="btn-icon">+</span>
                    添加文件
                  </button>
                  <button 
                    className="btn btn-text" 
                    onClick={handleClearBatchTasks}
                    disabled={isBatchProcessing || batchTasks.length === 0}
                  >
                    清空列表
                  </button>
                </div>
                <div className="actions-right">
                  {isBatchProcessing ? (
                    <button 
                      className="btn btn-danger" 
                      onClick={handleStopBatchProcessing}
                    >
                      <span className="btn-icon">⏹</span>
                      停止处理
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={handleBatchExport}
                        disabled={batchTasks.filter(t => t.status === 'success').length === 0}
                      >
                        <span className="btn-icon">💾</span>
                        导出全部
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={async () => {
                          const res = await (window as any).electronAPI.openFolder(batchOutputDir);
                          if (res && !res.success) {
                            showToast(`无法打开目录: ${res.error || '未知错误'}`, 'error');
                          }
                        }}
                        disabled={!batchOutputDir}
                        title={batchOutputDir ? `打开 ${batchOutputDir}` : '导出后可用'}
                      >
                        <span className="btn-icon">📂</span>
                        打开目录
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={handleStartBatchProcessing}
                        disabled={batchTasks.length === 0 || batchTasks.every(t => t.status === 'success')}
                      >
                        <span className="btn-icon">▶</span>
                        开始处理
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Preview Modal */}
      {showBatchPreview && selectedBatchTask && (() => {
        const idx = batchTasks.findIndex(t => t.id === selectedBatchTask.id);
        const hasPrev = idx > 0;
        const hasNext = idx >= 0 && idx < batchTasks.length - 1;
        return (
          <BatchPreviewModal
            task={selectedBatchTask}
            onClose={() => setShowBatchPreview(false)}
            onPrev={hasPrev ? () => setSelectedBatchTask(batchTasks[idx - 1]) : undefined}
            onNext={hasNext ? () => setSelectedBatchTask(batchTasks[idx + 1]) : undefined}
            indexInfo={idx >= 0 ? { current: idx + 1, total: batchTasks.length } : undefined}
          />
        );
      })()}

      <main className="main">
        <div className="toolbar">
          {/* 主要操作组：选择、抠图、导出、复制 */}
          <div className="toolbar-group main-actions">
            <button
              className="btn btn-primary"
              onClick={handleSelectImage}
              title="选择本地图片文件 (支持 PNG, JPG, WebP)"
            >
              <span className="btn-icon">📁</span>
              <span className="btn-text">选择</span>
            </button>
            {isGifProcessing ? (
              <button
                className="btn btn-error"
                onClick={cancelGifProcessing}
                title="取消 GIF 处理"
              >
                <span className="btn-icon">✕</span>
                <span className="btn-text">
                  GIF 抠图 {gifProgress.current}/{gifProgress.total}
                </span>
              </button>
            ) : (
              <button
                className="btn btn-success"
                onClick={handleProcess}
                disabled={!originalImage || isProcessing}
                title={!originalImage ? "请先选择图片" : isProcessing ? "正在处理中..." : "使用AI模型去除背景"}
              >
                <span className="btn-icon">{isProcessing ? '⏳' : '✨'}</span>
                <span className="btn-text">{isProcessing ? '处理中' : '抠图'}</span>
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => processedImage && setShowExportDialog(true)}
              disabled={!processedImage}
              title={!processedImage ? "请先处理图片" : "导出为图片"}
            >
              <span className="btn-icon">💾</span>
              <span className="btn-text">导出</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (isOriginalGif) {
                  showToast('GIF 格式不支持复制到剪贴板，请使用导出功能', 'info');
                } else {
                  handleCopyToClipboard();
                }
              }}
              disabled={!processedImage}
              title={!processedImage ? "请先处理图片" : isOriginalGif ? "GIF 格式不支持复制，请使用导出" : "复制到剪贴板"}
            >
              <span className="btn-icon">📋</span>
              <span className="btn-text">复制</span>
            </button>
          </div>

          {/* 批量处理组 */}
          <div className="toolbar-group batch-group">
            <button
              className="btn btn-secondary batch-btn"
              onClick={() => setShowBatchDialog(true)}
              title="批量处理多张图片"
            >
              <span className="btn-icon">📂</span>
              <span className="btn-text">批量抠图</span>
            </button>
          </div>

          {/* 视图控制组 */}
          <div className="toolbar-group">
            <div ref={zoomControlRef} className="zoom-control">
              <button
                className="btn btn-icon-only"
                onClick={() => setShowZoomDropdown(!showZoomDropdown)}
                title="缩放"
              >
                <span className="btn-icon">🔍</span>
                <span className="btn-badge">{Math.round(scale * 100)}%</span>
              </button>
              {showZoomDropdown && (
                <div className="zoom-dropdown">
                  <div className="zoom-option" onClick={() => { setZoomScale(0.1); setShowZoomDropdown(false); }}>10%</div>
                  <div className="zoom-option" onClick={() => { setZoomScale(0.25); setShowZoomDropdown(false); }}>25%</div>
                  <div className="zoom-option" onClick={() => { setZoomScale(0.5); setShowZoomDropdown(false); }}>50%</div>
                  <div className="zoom-option" onClick={() => { setZoomScale(0.75); setShowZoomDropdown(false); }}>75%</div>
                  <div className="zoom-option" onClick={() => { setZoomScale(1); setShowZoomDropdown(false); }}>100%</div>
                  <div className="zoom-option" onClick={() => { setZoomScale(1.5); setShowZoomDropdown(false); }}>150%</div>
                  <div className="zoom-option" onClick={() => { setZoomScale(2); setShowZoomDropdown(false); }}>200%</div>
                  <div className="zoom-option zoom-option-fit" onClick={() => { fitToPanel(); setShowZoomDropdown(false); }}>适应屏幕</div>
                </div>
              )}
            </div>

            {/* Background Picker */}
            {processedImage && (
              <div ref={bgPickerRef} className="bg-picker">
                <button
                  className="btn btn-icon-only"
                  onClick={() => setShowBgPicker(!showBgPicker)}
                  title="背景"
                >
                  <span className="btn-icon">🎨</span>
                </button>
                {showBgPicker && (
                  <div className="bg-picker-dropdown">
                    <div className="bg-picker-section">
                      <div className="bg-picker-label">预设颜色</div>
                      <div className="bg-picker-colors">
                        <div
                          className={`bg-picker-color ${bgColor === 'transparent' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('transparent'); setBgImage(null); showToast('背景已设为透明', 'success'); }}
                          title="透明"
                        >
                          <div className="bg-color-transparent" />
                        </div>
                        <div
                          className={`bg-picker-color ${bgColor === '#ffffff' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#ffffff'); setBgImage(null); showToast('背景已设为白色', 'success'); }}
                          style={{ backgroundColor: '#ffffff' }}
                          title="白色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#000000' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#000000'); setBgImage(null); showToast('背景已设为黑色', 'success'); }}
                          style={{ backgroundColor: '#000000' }}
                          title="黑色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#ef4444' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#ef4444'); setBgImage(null); showToast('背景已设为红色', 'success'); }}
                          style={{ backgroundColor: '#ef4444' }}
                          title="红色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#3b82f6' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#3b82f6'); setBgImage(null); showToast('背景已设为蓝色', 'success'); }}
                          style={{ backgroundColor: '#3b82f6' }}
                          title="蓝色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#10b981' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#10b981'); setBgImage(null); showToast('背景已设为绿色', 'success'); }}
                          style={{ backgroundColor: '#10b981' }}
                          title="绿色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#f59e0b' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#f59e0b'); setBgImage(null); showToast('背景已设为黄色', 'success'); }}
                          style={{ backgroundColor: '#f59e0b' }}
                          title="黄色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#8b5cf6' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#8b5cf6'); setBgImage(null); showToast('背景已设为紫色', 'success'); }}
                          style={{ backgroundColor: '#8b5cf6' }}
                          title="紫色"
                        />
                        <div
                          className={`bg-picker-color ${bgColor === '#ec4899' && !bgImage ? 'active' : ''}`}
                          onClick={() => { setBgColor('#ec4899'); setBgImage(null); showToast('背景已设为粉色', 'success'); }}
                          style={{ backgroundColor: '#ec4899' }}
                          title="粉色"
                        />
                      </div>
                    </div>
                    <div className="bg-picker-section">
                      <div className="bg-picker-label">自定义颜色</div>
                      <input
                        type="color"
                        value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                        onChange={(e) => { setBgColor(e.target.value); setBgImage(null); showToast('背景颜色已更新', 'success'); }}
                        className="bg-picker-color-input"
                        title="选择自定义颜色"
                      />
                    </div>
                    <div className="bg-picker-section">
                      <div className="bg-picker-label">背景图片</div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setBgImage(e.target?.result as string);
                                showToast('背景图片已设置', 'success');
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                      >
                        📁 选择图片
                      </button>
                      {bgImage && (
                          <button
                          className="btn btn-outline btn-sm"
                          onClick={() => { setBgImage(null); showToast('背景图片已清除', 'info'); }}
                          style={{ marginLeft: '8px' }}
                        >
                          ❌ 清除
                        </button>
                      )}
                    </div>
                    <div className="bg-picker-close" onClick={() => setShowBgPicker(false)}>
                      关闭
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 编辑工具组 */}
          {processedImage && !isOriginalGif && (
            <div className="toolbar-group">
              <div className="toolbar-tools">
                <button
                  className={`btn btn-icon-only ${editMode === 'erase' ? 'btn-active' : ''}`}
                  onClick={() => setEditMode(editMode === 'erase' ? 'none' : 'erase')}
                  title={editMode === 'erase' ? "退出擦除" : "擦除"}
                >
                  <span className="btn-icon">🧹</span>
                </button>
                <button
                  className={`btn btn-icon-only ${editMode === 'restore' ? 'btn-active' : ''}`}
                  onClick={() => setEditMode(editMode === 'restore' ? 'none' : 'restore')}
                  title={editMode === 'restore' ? "退出修补" : "修补"}
                >
                  <span className="btn-icon">✏️</span>
                </button>
                <button
                  className="btn btn-icon-only"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  title={historyIndex <= 0 ? "无法撤回" : `撤回 (${historyIndex})  ⌘Z`}
                >
                  <span className="btn-icon">↩️</span>
                </button>
                <button
                  className="btn btn-icon-only"
                  onClick={handleRedo}
                  disabled={historyIndex >= maskHistory.length - 1}
                  title={historyIndex >= maskHistory.length - 1 ? "无法重做" : `重做 (${maskHistory.length - 1 - historyIndex})  ⇧⌘Z`}
                >
                  <span className="btn-icon">↪️</span>
                </button>
              </div>

              {editMode !== 'none' && (
                <div className="brush-control compact">
                  <div className="brush-slider-wrapper">
                    <input
                      ref={brushSliderRef}
                      type="range"
                      min="5"
                      max="100"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      onMouseDown={() => setIsAdjustingBrush(true)}
                      onMouseUp={() => setIsAdjustingBrush(false)}
                      onMouseLeave={() => setIsAdjustingBrush(false)}
                      onMouseMove={(e) => {
                        if (isAdjustingBrush) {
                          const rect = brushSliderRef.current?.getBoundingClientRect();
                          if (rect) {
                            setBrushTooltipPos({ x: e.clientX - rect.left, y: -30 });
                          }
                        }
                      }}
                      className="brush-slider"
                      title="画笔大小"
                    />
                    {isAdjustingBrush && (
                      <div
                        className="brush-tooltip"
                        style={{
                          left: brushTooltipPos.x,
                          top: brushTooltipPos.y
                        }}
                      >
                        {brushSize}px
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


        </div>

        <div className={`workspace ${isOriginalPanelCollapsed ? 'original-collapsed' : ''}`}>
          <div className={`panel ${isOriginalPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header">
              <span>原图</span>
              <button
                className="panel-toggle-btn"
                onClick={() => setIsOriginalPanelCollapsed(!isOriginalPanelCollapsed)}
                title={isOriginalPanelCollapsed ? "展开原图" : "收起原图"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points={isOriginalPanelCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}></polyline>
                </svg>
              </button>
            </div>
            {!isOriginalPanelCollapsed && (
            <div
              ref={originalPanelRef}
              className={`panel-content ${dragActive ? 'drag-active' : ''} ${isDragging || isOriginalDragging ? 'dragging' : ''} ${editMode !== 'none' ? 'edit-mode' : ''}`}
              style={{ cursor: editMode !== 'none' ? (isOriginalDragging ? 'grabbing' : 'default') : 'grab' }}
              onClick={() => !originalImage && fileInputRef.current?.click()}
              onWheel={(e) => handleZoom(e as unknown as WheelEvent, originalPanelRef)}
              onMouseDown={editMode === 'none' ? handleMouseDown : handleOriginalMouseDown}
              onMouseMove={editMode !== 'none' ? (e) => {
                handleOriginalMouseMove(e);
                // Update both cursors simultaneously
                const originalCursor = originalCursorRef.current;
                const resultCursor = resultCursorRef.current;
                if (originalCursor) {
                  const originalRect = originalCursor.parentElement!.getBoundingClientRect();
                  originalCursor.style.left = `${e.clientX - originalRect.left}px`;
                  originalCursor.style.top = `${e.clientY - originalRect.top}px`;
                }
                if (resultCursor && resultPanelRef.current) {
                  const resultRect = resultPanelRef.current.getBoundingClientRect();
                  const originalRect = originalPanelRef.current?.getBoundingClientRect();
                  if (originalRect) {
                    const relativeX = (e.clientX - originalRect.left) / originalRect.width;
                    const relativeY = (e.clientY - originalRect.top) / originalRect.height;
                    resultCursor.style.left = `${relativeX * resultRect.width}px`;
                    resultCursor.style.top = `${relativeY * resultRect.height}px`;
                  }
                }
              } : undefined}
              onMouseUp={editMode !== 'none' ? handleOriginalMouseUp : undefined}
              onMouseEnter={() => setIsMouseInOriginalPanel(true)}
              onMouseLeave={() => {
                if (editMode !== 'none') {
                  handleOriginalMouseUp();
                }
                // editMode === 'none' 时,拖动由 window 级监听管理,无需在 leave 结束
                setIsMouseInOriginalPanel(false);
              }}
            >
              <div
                className="image-container"
                ref={originalTransformRef}
              >
                {originalImage && (
                  <img
                    ref={originalImgRef}
                    src={originalImage}
                    alt="Original"
                    className="preview-image"
                    onLoad={handleImageLoad}
                  />
                )}
              </div>
              {/* Virtual cursor in original panel */}
              {(isAdjustingBrush || (editMode !== 'none' && (isMouseInOriginalPanel || isMouseInResultPanel))) && (
                <div
                  ref={originalCursorRef}
                  className="virtual-cursor"
                  style={{
                    left: isAdjustingBrush ? '50%' : undefined,
                    top: isAdjustingBrush ? '50%' : undefined,
                    width: brushSize * scaleRef.current,
                    height: brushSize * scaleRef.current,
                    borderColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.8)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'),
                    backgroundColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.3)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)')
                  }}
                />
              )}
              {/* GIF Original Frames List */}
              {isOriginalGif && gifOriginalFrames.length > 0 && (
                <div
                  ref={origFramesListRef}
                  className="gif-frames-list original-frames"
                >
                  <div className="gif-frames-title">原图帧 ({gifOriginalFrames.length})</div>
                  <div className="gif-frames-container">
                    {gifOriginalFrames.map((frameUrl, index) => (
                      <div
                        key={`orig-${index}`}
                        className="gif-frame-item"
                        onClick={() => {
                          setSelectedGifFrame(index);
                          setShowGifFramePreview(true);
                        }}
                        title={`第 ${index + 1} 帧`}
                      >
                        <img src={frameUrl} alt={`Frame ${index + 1}`} />
                        <span className="gif-frame-number">{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!originalImage && (
                <div className="drop-zone" onClick={handleSelectImage} style={{ cursor: 'pointer' }}>
                  <div className="drop-zone-icon">📤</div>
                  <div className="drop-zone-text">
                    点击或拖拽图片到这里
                  </div>
                  <div className="drop-zone-hint">
                    支持 PNG、JPG、WEBP、GIF 格式
                  </div>
                  {recentFiles.length > 0 && (
                    <div className="recent-files" onClick={e => e.stopPropagation()}>
                      <div className="recent-files-title">最近打开</div>
                      <div className="recent-files-grid">
                        {recentFiles.map(entry => (
                          <div
                            key={entry.path}
                            className="recent-file-item"
                            title={entry.name + '\n' + entry.path}
                            onClick={() => handleOpenRecent(entry)}
                          >
                            <img src={entry.thumbnail} alt={entry.name} />
                            <span className="recent-file-name">{entry.name}</span>
                            <button
                              className="recent-file-remove"
                              onClick={(e) => { e.stopPropagation(); removeRecentFile(entry.path); }}
                              title="从列表移除"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>结果预览</span>
              {processedImage && (
                <>
                  <span className="preview-badge">已处理</span>
                  {isOriginalGif && (
                    <span className="preview-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>GIF</span>
                  )}
                  {editMode !== 'none' && (
                    <span className="edit-badge">{editMode === 'erase' ? '擦除模式' : '修补模式'}</span>
                  )}
                </>
              )}
            </div>
            <div
              ref={resultPanelRef}
              className={`panel-content result-panel ${isDragging ? 'dragging' : ''} ${editMode !== 'none' ? 'edit-mode' : ''}`}
              style={{ cursor: isOriginalGif || editMode === 'none' ? 'grab' : 'default' }}
              onWheel={(e) => handleZoom(e as unknown as WheelEvent, resultPanelRef)}
              onMouseDown={isOriginalGif ? handleMouseDown : (editMode === 'none' ? handleMouseDown : handleDrawStart)}
              onMouseMove={(!isOriginalGif && editMode !== 'none') ? (e) => {
                handleDrawMove(e);
                // Update both cursors simultaneously
                const resultCursor = resultCursorRef.current;
                const originalCursor = originalCursorRef.current;
                if (resultCursor) {
                  const resultRect = resultCursor.parentElement!.getBoundingClientRect();
                  resultCursor.style.left = `${e.clientX - resultRect.left}px`;
                  resultCursor.style.top = `${e.clientY - resultRect.top}px`;
                }
                if (originalCursor && originalPanelRef.current) {
                  const originalRect = originalPanelRef.current.getBoundingClientRect();
                  const resultRect = resultPanelRef.current?.getBoundingClientRect();
                  if (resultRect) {
                    const relativeX = (e.clientX - resultRect.left) / resultRect.width;
                    const relativeY = (e.clientY - resultRect.top) / resultRect.height;
                    originalCursor.style.left = `${relativeX * originalRect.width}px`;
                    originalCursor.style.top = `${relativeY * originalRect.height}px`;
                  }
                }
              } : undefined}
              onMouseUp={(!isOriginalGif && editMode !== 'none') ? handleDrawEnd : undefined}
              onMouseEnter={() => setIsMouseInResultPanel(true)}
              onMouseLeave={() => {
                if (!isOriginalGif && editMode !== 'none') {
                  handleDrawEnd();
                }
                // 拖动模式由 window 级监听管理,无需在 leave 结束
                setIsMouseInResultPanel(false);
              }}
            >
              <div
                className="image-container"
                ref={resultTransformRef}
                style={{
                  backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor,
                  backgroundImage: bgImage ? `url(${bgImage})` : bgColor === 'transparent' ? 
                    'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none',
                  backgroundSize: bgImage ? 'cover' : '20px 20px',
                  backgroundPosition: bgImage ? 'center' : '0 0, 0 10px, 10px -10px, -10px 0px'
                }}
              >
                {processedImage && isOriginalGif && (
                  <img
                    src={processedImage}
                    alt="Processed GIF"
                    className="preview-image"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                )}
                {processedImage && !isOriginalGif && (
                  <>
                    <canvas
                      ref={outputCanvasRef}
                      className="preview-canvas"
                    />
                    <canvas
                      ref={processedCanvasRef}
                      style={{ display: 'none' }}
                    />
                    <canvas
                      ref={maskCanvasRef}
                      style={{ display: 'none' }}
                    />
                    <canvas
                      ref={originalCanvasRef}
                      style={{ display: 'none' }}
                    />
                  </>
                )}
              </div>
              {/* Virtual cursor in result panel */}
              {(isAdjustingBrush || (editMode !== 'none' && (isMouseInOriginalPanel || isMouseInResultPanel))) && (
                <div
                  ref={resultCursorRef}
                  className="virtual-cursor"
                  style={{
                    left: isAdjustingBrush ? '50%' : undefined,
                    top: isAdjustingBrush ? '50%' : undefined,
                    width: brushSize * scaleRef.current,
                    height: brushSize * scaleRef.current,
                    borderColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.8)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'),
                    backgroundColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.3)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)')
                  }}
                />
              )}
              {/* GIF Processed Frames List */}
              {isOriginalGif && gifProcessedFrames.length > 0 && (
                <div
                  ref={procFramesListRef}
                  className="gif-frames-list processed-frames"
                >
                  <div className="gif-frames-title">处理后帧 ({gifProcessedFrames.length})</div>
                  <div className="gif-frames-container">
                    {gifProcessedFrames.map((frameUrl, index) => (
                      <div
                        key={`proc-${index}`}
                        className="gif-frame-item"
                        onClick={() => {
                          setSelectedGifFrame(index);
                          setShowGifFramePreview(true);
                        }}
                        title={`第 ${index + 1} 帧`}
                      >
                        <img src={frameUrl} alt={`Frame ${index + 1}`} />
                        <span className="gif-frame-number">{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!processedImage && (
                <div className="empty-result">
                  <div className="empty-icon">✨</div>
                  <div className="empty-text" style={{ fontSize: '16px', color: '#64748b', fontWeight: 500 }}>
                    {originalImage ? '点击"AI抠图"开始处理' : '等待图片上传'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                    {originalImage ? '智能AI将自动去除背景' : '支持拖拽或点击选择图片'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <span>使用 RMBG 本地AI模型 | 保护隐私 · 离线可用</span>
      </footer>

      {/* Toast Notification */}
      {toast.visible && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Keyboard Shortcuts Help Button */}
      <button
        className="shortcuts-help-btn"
        onClick={() => setShowShortcuts(true)}
        title="查看快捷键"
      >
        ⌨️
      </button>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal shortcuts-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>键盘快捷键</h3>
              <button className="modal-close" onClick={() => setShowShortcuts(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="shortcuts-list">
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>O</kbd>
                  <span>打开图片</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>P</kbd>
                  <span>AI 抠图</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>S</kbd>
                  <span>导出图片</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>C</kbd>
                  <span>复制到剪贴板</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>V</kbd>
                  <span>粘贴图片</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                  <span>撤销</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Ctrl</kbd> + <kbd>B</kbd>
                  <span>切换背景选择</span>
                </div>
                <div className="shortcut-item">
                  <kbd>?</kbd>
                  <span>显示快捷键</span>
                </div>
                <div className="shortcut-item">
                  <kbd>Esc</kbd>
                  <span>关闭弹窗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paste Confirmation Modal */}
      {showPasteConfirm && (
        <div className="modal-overlay" onClick={cancelPaste}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>替换图片</h3>
              <button className="modal-close" onClick={cancelPaste}>×</button>
            </div>
            <div className="modal-content">
              <p>当前已有图片，是否替换为新图片？</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                当前操作将丢失未保存的编辑内容
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={cancelPaste}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={confirmPaste}>
                  确认替换
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导出选项弹框 */}
      {showExportDialog && (
        <div className="modal-overlay modal-overlay-blocking" onClick={() => setShowExportDialog(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>导出图片</h3>
              <button className="modal-close" onClick={() => setShowExportDialog(false)}>×</button>
            </div>
            <div className="modal-content" style={{ padding: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  输出格式 {isOriginalGif && <span style={{ color: '#94a3b8' }}>(GIF 文件锁定为 GIF)</span>}
                </label>
                <select
                  className="output-format-select"
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as 'png' | 'webp' | 'jpg')}
                  disabled={isOriginalGif}
                  style={{ width: '100%' }}
                >
                  <option value="png">PNG — 无损,支持透明</option>
                  <option value="webp">WebP — 较小,支持透明</option>
                  <option value="jpg">JPG — 最小,不支持透明(以白色填充)</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isOriginalGif ? 'not-allowed' : 'pointer', opacity: isOriginalGif ? 0.5 : 1 }}>
                  <input
                    type="checkbox"
                    checked={autoCrop}
                    onChange={(e) => setAutoCrop(e.target.checked)}
                    disabled={isOriginalGif}
                  />
                  <span style={{ fontSize: 14 }}>智能裁切 — 自动去除透明边,文件更小</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowExportDialog(false)}
                >取消</button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setShowExportDialog(false);
                    await handleSaveWithMask();
                  }}
                >导出</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 下载模型说明弹框 */}
      {downloadDialog && (
        <div className="modal-overlay modal-overlay-blocking" onClick={() => setDownloadDialog(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>下载 {downloadDialog.displayName}</h3>
              <button className="modal-close" onClick={() => setDownloadDialog(null)}>×</button>
            </div>
            <div className="modal-content" style={{ padding: 20 }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                模型文件较大,需在浏览器中手动下载。下载完成后按以下步骤加载:
              </p>
              <ol style={{ marginBottom: 20, paddingLeft: 22, lineHeight: 2, fontSize: 14 }}>
                <li>点击下方"打开下载页",在浏览器中下载 <code style={{ background: 'var(--bg-color)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 }}>model.onnx</code></li>
                <li>回到模型列表,点击该模型的"选择文件",选取刚下载的文件 — 应用会自动放置并加载</li>
              </ol>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setDownloadDialog(null)}
                >稍后</button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await openExternalUrl(downloadDialog.url);
                      showToast('已在浏览器打开下载页', 'success');
                    } catch {
                      showToast('打开失败', 'error');
                    }
                    setDownloadDialog(null);
                  }}
                >打开下载页</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Batch Preview Modal Component
interface BatchPreviewModalProps {
  task: {
    id: string;
    file: File;
    fileName: string;
    status: 'pending' | 'processing' | 'success' | 'error' | 'retrying';
    originalImage?: string;
    processedImage?: string;
  };
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  indexInfo?: { current: number; total: number };
}

function BatchPreviewModal({ task, onClose, onPrev, onNext, indexInfo }: BatchPreviewModalProps) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  // 左右共享同一套 transform:scale + translate(像素)。
  // 缩放以鼠标点为锚点(参考主预览 handleZoom 的公式),让锚点视觉上保持不动,避免"乱动"。
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, tx: 0, ty: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (task.file) {
      const url = URL.createObjectURL(task.file);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [task.file]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(8, scaleRef.current * delta));

    // 以鼠标位置为锚点重算 translate,保持鼠标下的图像点视觉不动
    const panelCx = rect.width / 2;
    const panelCy = rect.height / 2;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - panelCx - translateRef.current.x) / scaleRef.current;
    const worldY = (mouseY - panelCy - translateRef.current.y) / scaleRef.current;
    const newTx = mouseX - panelCx - worldX * newScale;
    const newTy = mouseY - panelCy - worldY * newScale;

    scaleRef.current = newScale;
    translateRef.current = { x: newTx, y: newTy };
    setScale(newScale);
    setTranslate({ x: newTx, y: newTy });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      tx: translateRef.current.x,
      ty: translateRef.current.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newTx = dragStartRef.current.tx + dx;
      const newTy = dragStartRef.current.ty + dy;
      translateRef.current = { x: newTx, y: newTy };
      setTranslate({ x: newTx, y: newTy });
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        setIsDragging(false);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleReset = () => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // 切换任务时自动重置缩放/位置,避免上一张的 transform 残留到下一张
  useEffect(() => {
    handleReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // 键盘导航:← 上一张,→ 下一张,Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrev) { e.preventDefault(); onPrev(); }
      else if (e.key === 'ArrowRight' && onNext) { e.preventDefault(); onNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext, onClose]);

  const imgStyle: React.CSSProperties = {
    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    transformOrigin: '50% 50%',
    willChange: 'transform',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  };
  
  return (
    <div className="modal-overlay modal-overlay-blocking">
      <div className="modal modal-preview resizable-modal">
        <div className="modal-header">
          <h3 title={task.fileName}>
            图片预览 - {task.fileName}
            {indexInfo && (
              <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                ({indexInfo.current} / {indexInfo.total})
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onPrev}
              disabled={!onPrev}
              style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border-color)', background: 'transparent', borderRadius: 6, cursor: onPrev ? 'pointer' : 'not-allowed', opacity: onPrev ? 1 : 0.4 }}
              title="上一张 (←)"
            >◀ 上一张</button>
            <button
              onClick={onNext}
              disabled={!onNext}
              style={{ padding: '4px 10px', fontSize: 13, border: '1px solid var(--border-color)', background: 'transparent', borderRadius: 6, cursor: onNext ? 'pointer' : 'not-allowed', opacity: onNext ? 1 : 0.4 }}
              title="下一张 (→)"
            >下一张 ▶</button>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>缩放: {Math.round(scale * 100)}%</span>
            <button
              onClick={handleReset}
              style={{ padding: '4px 10px', fontSize: 12, border: '1px solid var(--border-color)', background: 'transparent', borderRadius: 6, cursor: 'pointer' }}
              title="重置缩放与位置"
            >重置</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-content preview-content">
          <div className="preview-comparison">
            <div className="preview-panel">
              <div className="preview-label">原始图片 (滚轮缩放 / 拖动平移)</div>
              <div
                className="preview-image-wrapper"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                style={{ overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {task.originalImage ? (
                  <img
                    src={task.originalImage}
                    alt="Original"
                    className="preview-img"
                    style={imgStyle}
                    draggable={false}
                  />
                ) : originalUrl ? (
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="preview-img"
                    style={imgStyle}
                    draggable={false}
                  />
                ) : (
                  <div className="preview-placeholder">
                    <span>暂无原始图片</span>
                  </div>
                )}
              </div>
            </div>
            <div className="preview-panel">
              <div className="preview-label">
                {task.status === 'success' ? '处理后 (滚轮缩放 / 拖动平移)' : '原图 (滚轮缩放 / 拖动平移)'}
              </div>
              <div
                className="preview-image-wrapper"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                style={{ overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {task.processedImage ? (
                  <img
                    src={task.processedImage}
                    alt="Processed"
                    className="preview-img"
                    style={{
                      ...imgStyle,
                      background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f3f4f6 0% 50%) 50% / 20px 20px',
                    }}
                    draggable={false}
                  />
                ) : originalUrl ? (
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="preview-img"
                    style={imgStyle}
                    draggable={false}
                  />
                ) : (
                  <div className="preview-placeholder">
                    <span>
                      {task.status === 'processing' ? '处理中...' : 
                       task.status === 'pending' ? '等待处理' : 
                       task.status === 'error' ? '处理失败' : '准备处理'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// GIF Frame Preview Modal Component

// GIF Frame Preview Modal Component - Improved version
interface GifFramePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  frameIndex: number | null;
  originalFrames: string[];
  processedFrames: string[];
}

function GifFramePreviewModal({ isOpen, onClose, frameIndex, originalFrames, processedFrames }: GifFramePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(frameIndex || 0);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const startTranslateRef = useRef({ x: 0, y: 0 });

  const totalFrames = Math.max(originalFrames.length, processedFrames.length);
  const originalUrl = originalFrames[currentIndex];
  const processedUrl = processedFrames[currentIndex];

  // Reset state when opening
  useEffect(() => {
    if (isOpen && frameIndex !== null) {
      setCurrentIndex(frameIndex);
      scaleRef.current = 1;
      translateRef.current = { x: 0, y: 0 };
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [isOpen, frameIndex]);
  
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevFrame();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextFrame();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, totalFrames]);
  
  const goToPrevFrame = () => {
    setCurrentIndex((prev: number) => (prev > 0 ? prev - 1 : totalFrames - 1));
    resetView();
  };
  
  const goToNextFrame = () => {
    setCurrentIndex((prev: number) => (prev < totalFrames - 1 ? prev + 1 : 0));
    resetView();
  };
  
  const resetView = () => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(8, scaleRef.current * delta));
    const panelCx = rect.width / 2;
    const panelCy = rect.height / 2;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - panelCx - translateRef.current.x) / scaleRef.current;
    const worldY = (mouseY - panelCy - translateRef.current.y) / scaleRef.current;
    const newTx = mouseX - panelCx - worldX * newScale;
    const newTy = mouseY - panelCy - worldY * newScale;
    scaleRef.current = newScale;
    translateRef.current = { x: newTx, y: newTy };
    setScale(newScale);
    setTranslate({ x: newTx, y: newTy });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startTranslateRef.current = { x: translateRef.current.x, y: translateRef.current.y };
    e.preventDefault();
  };

  // 拖动:用 window 级监听,鼠标拖出 wrapper 边界也能继续到松手
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const newTx = startTranslateRef.current.x + (e.clientX - startPosRef.current.x);
      const newTy = startTranslateRef.current.y + (e.clientY - startPosRef.current.y);
      translateRef.current = { x: newTx, y: newTy };
      setTranslate({ x: newTx, y: newTy });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const imageStyle: React.CSSProperties = {
    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    transformOrigin: '50% 50%',
    cursor: isDragging ? 'grabbing' : 'grab',
    willChange: 'transform',
    userSelect: 'none',
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-gif-frame" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="gif-frame-header-left">
            <h3>第 {currentIndex + 1} / {totalFrames} 帧</h3>
            <span className="gif-frame-scale">缩放: {Math.round(scale * 100)}%</span>
          </div>
          <div className="gif-frame-nav-buttons">
            <button 
              className="gif-frame-nav-btn" 
              onClick={goToPrevFrame}
              title="上一帧 (↑/←)"
            >
              ◀ 上一帧
            </button>
            <button 
              className="gif-frame-nav-btn" 
              onClick={goToNextFrame}
              title="下一帧 (↓/→)"
            >
              下一帧 ▶
            </button>
            <button 
              className="gif-frame-nav-btn reset-btn" 
              onClick={resetView}
              title="重置视图"
            >
              ⟲ 重置
            </button>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content gif-frame-content">
          <div className="gif-frame-comparison">
            {originalUrl && (
              <div className="gif-frame-panel">
                <div className="gif-frame-label">原图 (滚轮缩放 / 拖动平移)</div>
                <div
                  className="gif-frame-image-wrapper"
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  style={{ overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <img
                    src={originalUrl}
                    alt={`Original Frame ${currentIndex + 1}`}
                    style={imageStyle}
                    draggable={false}
                  />
                </div>
              </div>
            )}
            {processedUrl && (
              <div className="gif-frame-panel">
                <div className="gif-frame-label">处理后 (滚轮缩放 / 拖动平移)</div>
                <div
                  className="gif-frame-image-wrapper"
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  style={{ overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <img
                    src={processedUrl}
                    alt={`Processed Frame ${currentIndex + 1}`}
                    style={imageStyle}
                    draggable={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
