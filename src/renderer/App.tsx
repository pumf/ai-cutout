import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GifReader, GifWriter } from 'omggif';
import { listFixedModels, loadFixedModel, loadCustomModel, processImageWithModel, selectModel, openExternalUrl, saveImage, selectImage, loadImageFromPath, copyImageToClipboard, checkForUpdates, getBackendPort, selectMultipleImages, selectFolder, saveImageToPath, showItemInFolder } from '../api';
import { TitleBar } from './components/TitleBar';
import { Icon } from './components/Icon';
import { BatchPreviewModal } from './components/BatchPreviewModal';
import { GifFramePreviewModal } from './components/GifFramePreviewModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { PasteConfirmModal } from './components/PasteConfirmModal';
import { ExportDialog } from './components/ExportDialog';
import { DownloadInfoModal } from './components/DownloadInfoModal';
import { UpdateModal } from './components/UpdateModal';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { HelpModal } from './components/HelpModal';
import { BackgroundPicker } from './components/BackgroundPicker';
import { BatchProcessingModal } from './components/BatchProcessingModal';
import { SettingsModal } from './components/SettingsModal';
import type { BatchTask, RecentFile, CustomScene, BgFillMode, ModelInfo, CurrentModel, UpdateInfo, ToastState, DownloadDialogInfo } from './types';

// 声明 vite 注入的全局变量
declare const __APP_VERSION__: string;

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [currentModel, setCurrentModel] = useState<CurrentModel | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [errorModelId, setErrorModelId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch processing states
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchTasks, setBatchTasks] = useState<BatchTask[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState<string>('removed_bg_');
  const [batchConcurrency, setBatchConcurrency] = useState<number>(2);
  const [outputFormat, setOutputFormat] = useState<'png' | 'webp' | 'jpg'>('png');
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [featherRadius, setFeatherRadius] = useState<number>(0);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const abortBatchRef = useRef<boolean>(false);
  const batchAbortControllerRef = useRef<AbortController | null>(null);
  const batchStartTimeRef = useRef<number>(0);
  // 强制 ETA 在 task 间隙也刷新 — 每秒 +1,作为依赖让 progress 区重渲染
  const [etaTick, setEtaTick] = useState(0);
  const [selectedBatchTask, setSelectedBatchTask] = useState<BatchTask | null>(null);
  const [showBatchPreview, setShowBatchPreview] = useState(false);

  // Update check states
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

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
  // null = 默认 1fr 1fr 等分;否则左侧 panel 百分比(20-80)
  const [leftPanelPct, setLeftPanelPct] = useState<number | null>(null);
  const [isSplitterDragging, setIsSplitterDragging] = useState(false);
  const [copyJustDone, setCopyJustDone] = useState(false);
  
  // Background settings
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgImageName, setBgImageName] = useState<string | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [bgFillMode, setBgFillMode] = useState<BgFillMode>('cover');
  const [bgAlpha, setBgAlpha] = useState<number>(100); // 0-100 纯色背景不透明度
  const [bgScale, setBgScale] = useState<number>(100); // 50-300 背景图缩放
  const [bgOffsetX, setBgOffsetX] = useState<number>(0); // -50..50 X 偏移(%)
  const [bgOffsetY, setBgOffsetY] = useState<number>(0); // -50..50 Y 偏移(%)
  const [showBgAdvanced, setShowBgAdvanced] = useState(false);
  const [customScenes, setCustomScenes] = useState<CustomScene[]>([]);
  const [addingScene, setAddingScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Brush slider tooltip state
  const [isAdjustingBrush, setIsAdjustingBrush] = useState(false);
  const [brushTooltipPos, setBrushTooltipPos] = useState({ x: 0, y: 0 });
  const brushSliderRef = useRef<HTMLInputElement>(null);
  const bgPickerRef = useRef<HTMLDivElement>(null);
  const zoomControlRef = useRef<HTMLDivElement>(null);

  // Toast state
  const [toast, setToast] = useState<ToastState>({message: '', type: 'info', visible: false});
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 导出成功后的浮动"查看"按钮:5 秒内不点击自动消失
  const [exported, setExported] = useState<{ path: string; label: string } | null>(null);
  const exportedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcuts help
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Paste image confirmation
  const [showPasteConfirm, setShowPasteConfirm] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Download model dialog
  const [downloadDialog, setDownloadDialog] = useState<DownloadDialogInfo | null>(null);

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

  // 同步 bg 状态到 ref,让 native wheel/mousedown 监听器能即时读取
  const bgStateRef = useRef({ bgImage: null as string | null, bgScale: 100, bgOffsetX: 0, bgOffsetY: 0 });
  useEffect(() => {
    bgStateRef.current = { bgImage, bgScale, bgOffsetX, bgOffsetY };
  }, [bgImage, bgScale, bgOffsetX, bgOffsetY]);

  // Handle zoom with mouse position as anchor point - keep the point visually stationary
  const handleZoom = useCallback((e: WheelEvent, panelRef: React.RefObject<HTMLDivElement>) => {
    e.preventDefault();
    // Shift + 滚轮:若有背景图,改为缩放背景图(主图缩放是高频默认行为,不动)
    // 注意:macOS 触控板 Shift+滑动会把 deltaY 映射到 deltaX,
    // 必须同时考虑两者,否则只能单向缩放
    if (e.shiftKey && bgStateRef.current.bgImage) {
      const dir = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (dir === 0) return;
      setBgScale(prev => {
        const step = dir > 0 ? -5 : 5;
        return Math.max(10, Math.min(300, prev + step));
      });
      return;
    }
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
      // 大图预缩放,降低后端内存压力
      const { data: inputDataUrl, resized, originalSize } = await resizeIfTooLarge(originalImage);
      if (resized && originalSize) {
        showToast(`图片较大(${originalSize[0]}×${originalSize[1]}),已缩放至 ${MAX_INPUT_DIM}px 处理`, 'info');
      }
      const base64Data = inputDataUrl.replace(/^data:image\/\w+;base64,/, '');

      const blob = await processImageFrame(base64Data);
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
      setIsOriginalGif(false);
      showToast('AI 抠图完成！', 'success');
    } catch (e) {
      console.error('Processing failed:', e);
      const errorMsg = (e as Error).message || '未知错误';
      showToast(`处理失败: ${errorMsg}`, 'error');
      
      // 详细错误已通过 toast 显示;之前的浏览器原生 alert 体验差且引用了过时的 Tauri,移除
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

  // hex + alpha(0-100) → 用于 canvas fillStyle / CSS 的颜色字符串
  // bgColor === 'transparent' 直接返回 transparent
  const colorWithAlpha = (hex: string, alphaPct: number): string => {
    if (!hex || hex === 'transparent') return 'transparent';
    const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return hex; // 不识别的格式原样返回
    if (alphaPct >= 100) return hex; // 完全不透明,保留 hex(更直观)
    const a = Math.max(0, Math.min(1, alphaPct / 100));
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a.toFixed(3)})`;
  };

  // 在指定 ctx 上按填充模式绘制背景图(供合成与导出复用)
  // scale: center/repeat 模式的额外缩放(50-300,百分比);cover/contain 时忽略
  // offsetXPct / offsetYPct: 额外偏移,基于 canvas 尺寸的百分比
  const drawBackgroundImage = (
    ctx: CanvasRenderingContext2D,
    bgImg: HTMLImageElement,
    width: number,
    height: number,
    mode: 'cover' | 'contain' | 'center' | 'repeat' | 'custom',
    scale: number = 100,
    offsetXPct: number = 0,
    offsetYPct: number = 0
  ) => {
    const imgRatio = bgImg.width / bgImg.height;
    const canvasRatio = width / height;
    const offX = (offsetXPct / 100) * width;
    const offY = (offsetYPct / 100) * height;

    if (mode === 'cover') {
      let dw, dh, ox, oy;
      if (imgRatio > canvasRatio) { dh = height; dw = height * imgRatio; ox = (width - dw) / 2; oy = 0; }
      else { dw = width; dh = width / imgRatio; ox = 0; oy = (height - dh) / 2; }
      ctx.drawImage(bgImg, ox + offX, oy + offY, dw, dh);
    } else if (mode === 'contain') {
      let dw, dh, ox, oy;
      if (imgRatio > canvasRatio) { dw = width; dh = width / imgRatio; ox = 0; oy = (height - dh) / 2; }
      else { dh = height; dw = height * imgRatio; ox = (width - dw) / 2; oy = 0; }
      ctx.drawImage(bgImg, ox + offX, oy + offY, dw, dh);
    } else if (mode === 'center' || mode === 'custom') {
      // custom 与 center 算法一致(原图尺寸×scale,居中后再加 offset)
      // 差别只在 UI 语义:custom 暗示用户主动调整,center 暗示居中预设
      const s = scale / 100;
      const dw = bgImg.width * s;
      const dh = bgImg.height * s;
      ctx.drawImage(bgImg, (width - dw) / 2 + offX, (height - dh) / 2 + offY, dw, dh);
    } else if (mode === 'repeat') {
      // 用 ctx.translate 实现 pattern 偏移
      const s = scale / 100;
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(bgImg.width * s));
      tmp.height = Math.max(1, Math.round(bgImg.height * s));
      const tctx = tmp.getContext('2d')!;
      tctx.drawImage(bgImg, 0, 0, tmp.width, tmp.height);
      const pattern = ctx.createPattern(tmp, 'repeat');
      if (pattern) {
        ctx.save();
        ctx.translate(offX, offY);
        ctx.fillStyle = pattern;
        ctx.fillRect(-offX, -offY, width, height);
        ctx.restore();
      }
    }
  };

  // 大图(>4K)预缩放上限:超出长边时缩放到 4096px,
  // 减少后端推理时 numpy 内存峰值与 base64 传输量。后端推理本身固定 1024x1024,
  // 缩到 4K 不会显著影响 mask 质量,但节省 ~60% 内存与传输。
  const MAX_INPUT_DIM = 4096;

  // 检查图片长边,超过 maxDim 则用 canvas 高质量缩放;返回 { dataUrl, resized?, originalSize? }
  const resizeIfTooLarge = (dataUrl: string, maxDim: number = MAX_INPUT_DIM): Promise<{ data: string; resized: boolean; originalSize?: [number, number] }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (Math.max(w, h) <= maxDim) {
          resolve({ data: dataUrl, resized: false });
          return;
        }
        const scale = maxDim / Math.max(w, h);
        const newW = Math.round(w * scale);
        const newH = Math.round(h * scale);
        const cv = document.createElement('canvas');
        cv.width = newW;
        cv.height = newH;
        const ctx = cv.getContext('2d');
        if (!ctx) return reject(new Error('canvas 2d 不可用'));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newW, newH);
        resolve({ data: cv.toDataURL('image/png'), resized: true, originalSize: [w, h] });
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = dataUrl;
    });
  };

  // 边缘羽化:仅对 alpha 通道应用 GaussianBlur,保留 RGB 锐利不"晕染"
  // 步骤:提取 alpha → 灰度 canvas → ctx.filter blur → 把模糊后的灰度值写回 alpha
  const featherEdge = (dataUrl: string, radius: number): Promise<string> => {
    if (radius <= 0) return Promise.resolve(dataUrl);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          // 1) 原图 imageData
          const srcCv = document.createElement('canvas');
          srcCv.width = w; srcCv.height = h;
          const sctx = srcCv.getContext('2d')!;
          sctx.drawImage(img, 0, 0);
          const original = sctx.getImageData(0, 0, w, h);
          // 2) 灰度 mask(把 alpha 提到 R/G/B,alpha 设 255)
          const maskCv = document.createElement('canvas');
          maskCv.width = w; maskCv.height = h;
          const mctx = maskCv.getContext('2d')!;
          const maskImg = mctx.createImageData(w, h);
          for (let i = 0; i < original.data.length; i += 4) {
            const a = original.data[i + 3];
            maskImg.data[i] = a;
            maskImg.data[i + 1] = a;
            maskImg.data[i + 2] = a;
            maskImg.data[i + 3] = 255;
          }
          mctx.putImageData(maskImg, 0, 0);
          // 3) 模糊 mask
          const blurCv = document.createElement('canvas');
          blurCv.width = w; blurCv.height = h;
          const bctx = blurCv.getContext('2d')!;
          bctx.filter = `blur(${radius}px)`;
          bctx.drawImage(maskCv, 0, 0);
          const blurred = bctx.getImageData(0, 0, w, h);
          // 4) 把模糊后的灰度值写回 alpha
          const outCv = document.createElement('canvas');
          outCv.width = w; outCv.height = h;
          const octx = outCv.getContext('2d')!;
          const result = octx.createImageData(w, h);
          for (let i = 0; i < result.data.length; i += 4) {
            result.data[i] = original.data[i];
            result.data[i + 1] = original.data[i + 1];
            result.data[i + 2] = original.data[i + 2];
            result.data[i + 3] = blurred.data[i];
          }
          octx.putImageData(result, 0, 0);
          resolve(outCv.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = dataUrl;
    });
  };

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

  // 双 panel 分隔条比例:启动读取 + 拖动持久化
  useEffect(() => {
    try {
      const raw = localStorage.getItem('leftPanelPct');
      if (raw !== null) {
        const n = Number(raw);
        if (!isNaN(n) && n >= 20 && n <= 80) setLeftPanelPct(n);
      }
    } catch {}
  }, []);

  const handleSplitterDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const workspaceEl = e.currentTarget.parentElement;
    if (!workspaceEl) return;
    setIsSplitterDragging(true);
    const rect = workspaceEl.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPanelPct(Math.max(20, Math.min(80, Math.round(pct))));
    };
    const onUp = () => {
      setIsSplitterDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // 持久化最后的比例
      try {
        const final = ((window.event as MouseEvent)?.clientX || 0);
        // 实际从 state 读更稳,这里直接用最后一次 setState 已写入
      } catch {}
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // 比例变化时持久化(独立于 drag,任何时机改都保存)
  useEffect(() => {
    if (leftPanelPct === null) return;
    try { localStorage.setItem('leftPanelPct', String(leftPanelPct)); } catch {}
  }, [leftPanelPct]);

  const handleSplitterDoubleClick = () => {
    setLeftPanelPct(null);
    try { localStorage.removeItem('leftPanelPct'); } catch {}
  };

  // 自定义场景:启动读 + 增删
  useEffect(() => {
    try {
      const raw = localStorage.getItem('customScenes');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCustomScenes(arr.slice(0, 8));
      }
    } catch {}
  }, []);

  const persistCustomScenes = (scenes: Array<{ name: string; color: string }>) => {
    try { localStorage.setItem('customScenes', JSON.stringify(scenes)); } catch {}
  };

  const handleAddCustomScene = () => {
    const name = newSceneName.trim();
    if (!name) return;
    if (bgColor === 'transparent') {
      showToast('请先选个颜色再保存场景', 'error');
      return;
    }
    setCustomScenes(prev => {
      const next = [...prev.filter(s => s.color.toLowerCase() !== bgColor.toLowerCase()), { name, color: bgColor }].slice(0, 8);
      persistCustomScenes(next);
      return next;
    });
    setAddingScene(false);
    setNewSceneName('');
  };

  const handleRemoveCustomScene = (color: string) => {
    setCustomScenes(prev => {
      const next = prev.filter(s => s.color !== color);
      persistCustomScenes(next);
      return next;
    });
  };

  // 最近使用的自定义颜色:启动读 + 自定义颜色变更时追加
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentColors');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecentColors(arr.filter(c => typeof c === 'string').slice(0, 5));
      }
    } catch {}
  }, []);

  const addRecentColor = (color: string) => {
    if (!color || color === 'transparent') return;
    setRecentColors(prev => {
      const next = [color, ...prev.filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, 5);
      try { localStorage.setItem('recentColors', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // 用户偏好:导出格式 / 智能裁切 / 批量前缀 / 批量并发 — 启动读 + 变更写
  // 注意:不持久化 bgColor(每次启动期望默认透明,避免上次的颜色残留干扰)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userPrefs');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.outputFormat === 'png' || p.outputFormat === 'webp' || p.outputFormat === 'jpg') setOutputFormat(p.outputFormat);
      if (typeof p.autoCrop === 'boolean') setAutoCrop(p.autoCrop);
      if (typeof p.featherRadius === 'number' && p.featherRadius >= 0 && p.featherRadius <= 10) setFeatherRadius(p.featherRadius);
      if (p.bgFillMode === 'cover' || p.bgFillMode === 'contain' || p.bgFillMode === 'center' || p.bgFillMode === 'repeat' || p.bgFillMode === 'custom') setBgFillMode(p.bgFillMode);
      if (typeof p.batchPrefix === 'string') setBatchPrefix(p.batchPrefix);
      if (typeof p.batchConcurrency === 'number' && p.batchConcurrency >= 1 && p.batchConcurrency <= 8) setBatchConcurrency(p.batchConcurrency);
    } catch (e) {
      console.warn('Failed to load user prefs:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('userPrefs', JSON.stringify({
        outputFormat, autoCrop, featherRadius, bgFillMode, batchPrefix, batchConcurrency,
      }));
    } catch {}
  }, [outputFormat, autoCrop, featherRadius, bgFillMode, batchPrefix, batchConcurrency]);

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
      
      // Convert to base64,大图自动缩放到 4K 上限以降低后端内存峰值
      const mime = task.file.type || 'image/png';
      const rawBase64 = arrayBufferToBase64(arrayBuffer);
      const tempDataUrl = `data:${mime};base64,${rawBase64}`;
      const { data: inputDataUrl } = await resizeIfTooLarge(tempDataUrl);
      const base64 = inputDataUrl === tempDataUrl
        ? rawBase64
        : inputDataUrl.replace(/^data:image\/\w+;base64,/, '');

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
      let exported = 0;
      let lastOutputPath = '';

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

          // 非 GIF 才按用户的 outputFormat / autoCrop / featherRadius 应用
          if (!isGifTask) {
            if (featherRadius > 0) dataUrl = await featherEdge(dataUrl, featherRadius);
            if (autoCrop) dataUrl = await cropToContent(dataUrl);
            if (outputFormat !== 'png') dataUrl = await convertImageFormat(dataUrl, outputFormat);
          }

          await saveImageToPath(dataUrl, outputPath);
          lastOutputPath = outputPath;
          exported++;
        } catch (err) {
          console.error('Export failed for task:', task.id, err);
        }
      }

      if (exported > 0 && lastOutputPath) {
        flashExportedPath(lastOutputPath, `批量导出完成 (${exported}/${successTasks.length})`);
      } else {
        showToast('导出失败', 'error');
      }
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
        // 普通图片:羽化 → 智能裁切 → 格式转换(顺序重要:先羽化再裁切,
        // 避免羽化后的半透明边缘被裁掉)
        defaultName = `removed_bg.${formatExt(outputFormat)}`;
        if (featherRadius > 0) imageData = await featherEdge(imageData, featherRadius);
        if (autoCrop) imageData = await cropToContent(imageData);
        if (outputFormat !== 'png') imageData = await convertImageFormat(imageData, outputFormat);
      }

      const result = await saveImage(imageData, defaultName);
      if (result) {
        flashExportedPath(result);
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

  // 背景图直接拖动:Shift + drag 调整 bgOffset
  const [isBgDragging, setIsBgDragging] = useState(false);
  const bgDragStartRef = useRef({ mouseX: 0, mouseY: 0, offX: 0, offY: 0, panelW: 1, panelH: 1 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!originalImage && !processedImage) return;
    // Shift + 鼠标按下:若有背景图,进入"拖动背景"模式(主图拖动是高频默认行为)
    if (e.shiftKey && bgStateRef.current.bgImage) {
      const panel = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      bgDragStartRef.current = {
        mouseX: e.clientX, mouseY: e.clientY,
        offX: bgStateRef.current.bgOffsetX, offY: bgStateRef.current.bgOffsetY,
        panelW: panel.width || 1, panelH: panel.height || 1,
      };
      setIsBgDragging(true);
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startTranslateRef.current = { x: translateXRef.current, y: translateYRef.current };
  }, [originalImage, processedImage]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 主预览拖动:window 级监听,即使鼠标拖出 panel 边界也能继续到松手再结束
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

  // 背景图拖动:window 级监听;鼠标位移按 panel 尺寸百分比映射到 bgOffset
  useEffect(() => {
    if (!isBgDragging) return;
    const onMove = (e: MouseEvent) => {
      const s = bgDragStartRef.current;
      const dxPct = ((e.clientX - s.mouseX) / s.panelW) * 100;
      const dyPct = ((e.clientY - s.mouseY) / s.panelH) * 100;
      // 取整避免滑块显示小数
      setBgOffsetX(Math.max(-50, Math.min(50, Math.round(s.offX + dxPct))));
      setBgOffsetY(Math.max(-50, Math.min(50, Math.round(s.offY + dyPct))));
    };
    const onUp = () => setIsBgDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isBgDragging]);

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

        // Load original image — 用 fetch + createImageBitmap 替代 new Image()
        // 后者对超大 dataURL / blob URL 可能 onload 不触发;前者更稳健
        (async () => {
          try {
            const response = await fetch(originalImage);
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);
            const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
            if (originalCtx) {
              originalCtx.clearRect(0, 0, width, height);
              originalCtx.imageSmoothingEnabled = true;
              originalCtx.imageSmoothingQuality = 'high';
              originalCtx.drawImage(bitmap, 0, 0, width, height);
            }
            bitmap.close();
          } catch (e) {
            console.error('[restore-cache] load failed', e);
            showToast('原图缓存加载失败,修补功能可能不可用', 'error');
          }
          applyMaskToOutput();
        })();

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

  // 导出成功后 flash 一个浮动 pill,5 秒内不点击自动消失
  const flashExportedPath = (filePath: string, label: string = '图片已导出') => {
    if (exportedTimerRef.current) clearTimeout(exportedTimerRef.current);
    setExported({ path: filePath, label });
    exportedTimerRef.current = setTimeout(() => setExported(null), 5000);
  };

  const dismissExportedPath = () => {
    if (exportedTimerRef.current) {
      clearTimeout(exportedTimerRef.current);
      exportedTimerRef.current = null;
    }
    setExported(null);
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

  // 软笔刷擦除核心:
  // 1) 仅在 stroke 局部矩形(brushSize + 边距)创建小 offscreen canvas
  // 2) 在 offscreen 上画 lineCap=round 单 stroke,filter blur(0.6px) 软化边缘
  //    GPU 在 alpha 上做抗锯齿,边缘像素 alpha 平滑过渡 → 放大无锯齿
  // 3) drawImage offscreen → 主画布 with destination-out 一次性擦除
  // 优于"多 arc fill 叠加":单 path,无 alpha 颗粒堆积,无毛刺
  const eraseWithSmoothMask = (
    outputCtx: CanvasRenderingContext2D,
    outputCanvas: HTMLCanvasElement,
    fromX: number, fromY: number,
    toX: number, toY: number,
    size: number
  ) => {
    const halfWidth = size / 2;
    // bounding box + 留 margin 防 blur 截断
    const margin = Math.ceil(halfWidth + 2);
    const x1 = Math.floor(Math.min(fromX, toX) - margin);
    const y1 = Math.floor(Math.min(fromY, toY) - margin);
    const x2 = Math.ceil(Math.max(fromX, toX) + margin);
    const y2 = Math.ceil(Math.max(fromY, toY) + margin);
    const bx = Math.max(0, x1);
    const by = Math.max(0, y1);
    const bw = Math.min(outputCanvas.width, x2) - bx;
    const bh = Math.min(outputCanvas.height, y2) - by;
    if (bw <= 0 || bh <= 0) return;

    const off = document.createElement('canvas');
    off.width = bw;
    off.height = bh;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.translate(-bx, -by);
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    octx.lineWidth = size;
    octx.strokeStyle = 'black';
    // 微 blur 0.6px:边缘 alpha 平滑过渡,放大无锯齿,几乎不扩展实际范围
    octx.filter = 'blur(0.6px)';
    octx.beginPath();
    octx.moveTo(fromX, fromY);
    octx.lineTo(fromX === toX && fromY === toY ? toX + 0.01 : toX, toY);
    octx.stroke();

    outputCtx.save();
    outputCtx.globalCompositeOperation = 'destination-out';
    outputCtx.drawImage(off, bx, by);
    outputCtx.restore();
  };

  // 修补软笔刷:像素级判断 — 对 bbox 内每个像素计算到线段的距离,
  // 在胶囊半径内则直接用 originalCanvas 对应像素覆盖 outputCanvas
  // 边缘 1px 内做 alpha 软化避免锯齿
  const restoreWithSmoothMask = (
    outputCtx: CanvasRenderingContext2D,
    outputCanvas: HTMLCanvasElement,
    originalCanvas: HTMLCanvasElement,
    fromX: number, fromY: number,
    toX: number, toY: number,
    size: number
  ) => {
    const half = size / 2;
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    if (!originalCtx) return;

    // bbox(向外 +1 留软边缘空间)
    const x1 = Math.max(0, Math.floor(Math.min(fromX, toX) - half - 1));
    const y1 = Math.max(0, Math.floor(Math.min(fromY, toY) - half - 1));
    const x2 = Math.min(outputCanvas.width, Math.ceil(Math.max(fromX, toX) + half + 1));
    const y2 = Math.min(outputCanvas.height, Math.ceil(Math.max(fromY, toY) + half + 1));
    const bw = x2 - x1;
    const bh = y2 - y1;
    if (bw <= 0 || bh <= 0) return;

    const original = originalCtx.getImageData(x1, y1, bw, bh);
    const output = outputCtx.getImageData(x1, y1, bw, bh);
    const od = original.data;
    const out = output.data;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const lenSq = dx * dx + dy * dy;
    const innerR = Math.max(0, half - 1);
    const innerRSq = innerR * innerR;
    const outerRSq = half * half;

    for (let py = 0; py < bh; py++) {
      const wy = py + y1;
      for (let px = 0; px < bw; px++) {
        const wx = px + x1;
        // 计算 (wx, wy) 到线段 from-to 的距离的平方
        let distSq: number;
        if (lenSq < 0.25) {
          const ex = wx - fromX, ey = wy - fromY;
          distSq = ex * ex + ey * ey;
        } else {
          // 投影 t 范围 [0,1]
          let t = ((wx - fromX) * dx + (wy - fromY) * dy) / lenSq;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          const pjx = fromX + t * dx;
          const pjy = fromY + t * dy;
          const ex = wx - pjx, ey = wy - pjy;
          distSq = ex * ex + ey * ey;
        }
        if (distSq > outerRSq) continue;
        const i = (py * bw + px) * 4;
        if (distSq <= innerRSq) {
          // 完全在内圈,直接覆盖
          out[i] = od[i];
          out[i + 1] = od[i + 1];
          out[i + 2] = od[i + 2];
          out[i + 3] = od[i + 3];
        } else {
          // 边缘 1px 软化:alpha 线性衰减,避免锯齿
          const dist = Math.sqrt(distSq);
          const k = half - dist; // 0..1
          const oldA = out[i + 3];
          const newA = od[i + 3] * k;
          // 取大者,避免反复涂抹时 alpha 反复升降
          if (newA > oldA) {
            out[i] = od[i];
            out[i + 1] = od[i + 1];
            out[i + 2] = od[i + 2];
            out[i + 3] = newA;
          }
        }
      }
    }

    outputCtx.putImageData(output, x1, y1);
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
      // 业界软笔刷标准实现:局部 offscreen canvas + 微 blur,
      // GPU 在 alpha 通道上做抗锯齿模糊,放大也无锯齿;
      // 仅处理 brush 大小的小区域,性能跟手
      eraseWithSmoothMask(outputCtx, outputCanvas, x, y, x, y, brushSize);
    } else {
      // 修补:用软笔刷 + mask + source-in 模式,即使主画布原来透明也能填上原图
      restoreWithSmoothMask(outputCtx, outputCanvas, originalCanvas, x, y, x, y, brushSize);
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
    const steps = Math.max(1, Math.ceil(distance / Math.max(0.5, radius * 0.15)));

    if (editMode === 'erase') {
      eraseWithSmoothMask(outputCtx, outputCanvas, from.x, from.y, to.x, to.y, brushSize);
    } else {
      // 修补连续路径:单 stroke + source-in + originalCanvas,平滑且能填透明区域
      restoreWithSmoothMask(outputCtx, outputCanvas, originalCanvas, from.x, from.y, to.x, to.y, brushSize);
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
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        bgImg.onload = () => {
          drawBackgroundImage(ctx, bgImg, width, height, bgFillMode, bgScale, bgOffsetX, bgOffsetY);
          resolve();
        };
        bgImg.onerror = () => resolve();
        bgImg.src = bgImage;
      });
    } else if (bgColor !== 'transparent') {
      // Draw background color
      ctx.fillStyle = colorWithAlpha(bgColor, bgAlpha);
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
          drawBackgroundImage(ctx, bgImg, width, height, bgFillMode, bgScale, bgOffsetX, bgOffsetY);
        } else if (bgColor !== 'transparent') {
          ctx.fillStyle = colorWithAlpha(bgColor, bgAlpha);
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
            flashExportedPath(result);
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
          flashExportedPath(result);
        }
        // If result is null, user cancelled - no message needed
      }
      return;
    }
    
    const composedCanvas = await composeImageWithBackground();
    if (!composedCanvas) return;

    // 羽化(透明背景才有半透明 alpha 可以羽化;有底色时 mask 全 255 不变)
    // → 智能裁切 → 格式转换
    let dataUrl = composedCanvas.toDataURL('image/png');
    if (featherRadius > 0) dataUrl = await featherEdge(dataUrl, featherRadius);
    if (autoCrop) dataUrl = await cropToContent(dataUrl);
    if (outputFormat !== 'png') dataUrl = await convertImageFormat(dataUrl, outputFormat);

    const result = await saveImage(dataUrl, `removed_bg_edited.${formatExt(outputFormat)}`);
    if (result) {
      flashExportedPath(result);
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
      setCopyJustDone(true);
      setTimeout(() => setCopyJustDone(false), 1500);
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
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          appVersion={__APP_VERSION__}
          availableModels={availableModels}
          currentModel={currentModel}
          loadingModelId={loadingModelId}
          errorModelId={errorModelId}
          onLoadModel={handleLoadFixedModel}
          onSelectCustomModel={selectCustomModel}
          onRefreshModels={async () => {
            const list = await listFixedModels();
            if (Array.isArray(list)) setAvailableModels(list);
          }}
          onToast={showToast}
          onOpenExternal={(url) => { void openExternalUrl(url); }}
          onUpdateAvailable={(info) => {
            setUpdateInfo(info);
            setShowUpdateDialog(true);
          }}
        />
      )}
      {showModelSelector && (
        <ModelSelectorModal
          availableModels={availableModels}
          currentModel={currentModel}
          loadingModelId={loadingModelId}
          errorModelId={errorModelId}
          isLoadingModel={isLoadingModel}
          onClose={() => setShowModelSelector(false)}
          onLoadModel={handleLoadFixedModel}
          onSelectCustomModel={selectCustomModel}
          onDownloadModel={handleDownloadModel}
        />
      )}

      {/* Update Dialog */}
      {showUpdateDialog && updateInfo && (
        <UpdateModal
          info={updateInfo}
          onDismiss={handleUpdateDismiss}
          onDownload={handleUpdateDownload}
        />
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
        <HelpModal
          appVersion={__APP_VERSION__}
          currentVersionLabel={updateInfo?.currentVersion}
          onClose={() => setShowHelp(false)}
          onCheckUpdate={async () => {
            showToast('正在检查更新...', 'info');
            try {
              const result = await checkForUpdates();
              if (result.hasUpdate) {
                setUpdateInfo(result);
                setShowUpdateDialog(true);
                setShowHelp(false);
                showToast('发现新版本！', 'success');
              } else {
                showToast('当前已是最新版本', 'success');
              }
            } catch (error) {
              console.error('Failed to check for updates:', error);
              showToast('检查更新失败，请稍后重试', 'error');
            }
          }}
          onOpenExternal={(url) => { window.open(url, '_blank'); }}
        />
      )}

      {/* Batch Processing Dialog */}
      {showBatchDialog && (
        <BatchProcessingModal
          tasks={batchTasks}
          isBatchProcessing={isBatchProcessing}
          batchConcurrency={batchConcurrency}
          setBatchConcurrency={setBatchConcurrency}
          batchPrefix={batchPrefix}
          setBatchPrefix={setBatchPrefix}
          batchStartTimeMs={batchStartTimeRef.current}
          etaTick={etaTick}
          formatEta={formatEta}
          selectedTaskId={selectedBatchTask?.id}
          onPreview={(task) => { setSelectedBatchTask(task); setShowBatchPreview(true); }}
          onAddFiles={handleBatchFilesSelect}
          onClear={handleClearBatchTasks}
          onClose={handleBatchDialogClose}
          onStart={handleStartBatchProcessing}
          onStop={handleStopBatchProcessing}
          onExport={handleBatchExport}
          onRetry={handleRetryTask}
          onRemove={handleRemoveBatchTask}
        />
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
              title="选择本地图片文件 (⌘O,支持 PNG / JPG / WebP / GIF)"
            >
              <span className="btn-icon"><Icon name="folder-open" /></span>
              <span className="btn-text">选择</span>
            </button>
            {isGifProcessing ? (
              <button
                className="btn btn-cta btn-cancel-gif"
                onClick={cancelGifProcessing}
                title="取消 GIF 处理"
              >
                <span className="btn-icon"><Icon name="x" /></span>
                <span className="btn-text">
                  GIF 抠图 {gifProgress.current}/{gifProgress.total}
                </span>
                <span
                  className="btn-progress"
                  style={{ width: `${gifProgress.total ? (gifProgress.current / gifProgress.total) * 100 : 0}%` }}
                />
              </button>
            ) : (
              <button
                className={`btn btn-cta ${isProcessing ? 'is-processing' : ''}`}
                onClick={handleProcess}
                disabled={!originalImage || isProcessing}
                title={!originalImage ? "请先选择图片" : isProcessing ? "正在处理中..." : "使用 AI 模型去除背景 (⌘P)"}
              >
                <span className="btn-icon">{isProcessing ? <span className="btn-cta-spinner" /> : <Icon name="sparkles" size={18} />}</span>
                <span className="btn-text">{isProcessing ? '处理中' : '抠图'}</span>
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => processedImage && setShowExportDialog(true)}
              disabled={!processedImage}
              title={!processedImage ? "请先处理图片" : "导出为图片 (⌘S)"}
            >
              <span className="btn-icon"><Icon name="download" /></span>
              <span className="btn-text">导出</span>
            </button>
            <button
              className={`btn btn-secondary ${copyJustDone ? 'btn-copy-success' : ''}`}
              onClick={() => {
                if (isOriginalGif) {
                  showToast('GIF 格式不支持复制到剪贴板，请使用导出功能', 'info');
                } else {
                  handleCopyToClipboard();
                }
              }}
              disabled={!processedImage}
              title={!processedImage ? "请先处理图片" : isOriginalGif ? "GIF 格式不支持复制，请使用导出" : "复制到剪贴板 (⌘C)"}
            >
              <span className="btn-icon">{copyJustDone ? <Icon name="check" /> : <Icon name="copy" />}</span>
              <span className="btn-text">{copyJustDone ? '已复制' : '复制'}</span>
            </button>
          </div>

          {/* 批量处理组 */}
          <div className="toolbar-group batch-group">
            <button
              className="btn btn-secondary batch-btn"
              onClick={() => setShowBatchDialog(true)}
              title="批量处理多张图片"
            >
              <span className="btn-icon"><Icon name="layers" /></span>
              <span className="btn-text">批量抠图</span>
            </button>
          </div>

          {/* 视图控制组 */}
          <div className="toolbar-group">
            <div ref={zoomControlRef} className="zoom-control">
              <button
                className="btn btn-zoom"
                onClick={() => setShowZoomDropdown(!showZoomDropdown)}
                title="缩放主图(滚轮也可)"
              >
                <span className="btn-text">{Math.round(scale * 100)}%</span>
                <span className="btn-zoom-arrow">▾</span>
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
              <BackgroundPicker
                ref={bgPickerRef}
                open={showBgPicker}
                onToggle={() => setShowBgPicker(!showBgPicker)}
                bgColor={bgColor}
                setBgColor={setBgColor}
                bgImage={bgImage}
                setBgImage={setBgImage}
                bgImageName={bgImageName}
                setBgImageName={setBgImageName}
                bgFillMode={bgFillMode}
                setBgFillMode={setBgFillMode}
                bgAlpha={bgAlpha}
                setBgAlpha={setBgAlpha}
                bgScale={bgScale}
                setBgScale={setBgScale}
                bgOffsetX={bgOffsetX}
                setBgOffsetX={setBgOffsetX}
                bgOffsetY={bgOffsetY}
                setBgOffsetY={setBgOffsetY}
                showBgAdvanced={showBgAdvanced}
                setShowBgAdvanced={setShowBgAdvanced}
                recentColors={recentColors}
                addRecentColor={addRecentColor}
                customScenes={customScenes}
                addingScene={addingScene}
                setAddingScene={setAddingScene}
                newSceneName={newSceneName}
                setNewSceneName={setNewSceneName}
                onAddCustomScene={handleAddCustomScene}
                onRemoveCustomScene={handleRemoveCustomScene}
              />
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
                  <span className="btn-icon"><Icon name="eraser" /></span>
                </button>
                <button
                  className={`btn btn-icon-only ${editMode === 'restore' ? 'btn-active' : ''}`}
                  onClick={() => setEditMode(editMode === 'restore' ? 'none' : 'restore')}
                  title={editMode === 'restore' ? "退出修补" : "修补"}
                >
                  <span className="btn-icon"><Icon name="brush" /></span>
                </button>
                {/* 撤销/重做仅在擦除/修补编辑模式下显示,普通查看时不占空间 */}
                {editMode !== 'none' && (
                  <>
                    <button
                      className="btn btn-icon-only"
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      title={historyIndex <= 0 ? "无法撤回" : `撤回 (${historyIndex})  ⌘Z`}
                    >
                      <span className="btn-icon"><Icon name="undo" /></span>
                    </button>
                    <button
                      className="btn btn-icon-only"
                      onClick={handleRedo}
                      disabled={historyIndex >= maskHistory.length - 1}
                      title={historyIndex >= maskHistory.length - 1 ? "无法重做" : `重做 (${maskHistory.length - 1 - historyIndex})  ⇧⌘Z`}
                    >
                      <span className="btn-icon"><Icon name="redo" /></span>
                    </button>
                  </>
                )}
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

        <div
          className={`workspace ${isOriginalPanelCollapsed ? 'original-collapsed' : ''} ${isSplitterDragging ? 'splitter-dragging' : ''}`}
          style={{
            // 折叠时 2 列(无 splitter);展开时 3 列(可拖动)
            gridTemplateColumns: isOriginalPanelCollapsed
              ? 'auto 1fr'
              : leftPanelPct !== null
                ? `${leftPanelPct}% 8px ${100 - leftPanelPct}%`
                : '1fr 8px 1fr',
          }}
        >
          <div className={`panel ${isOriginalPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-header">
              <span>原图</span>
              <button
                className="panel-toggle-btn"
                onClick={() => setIsOriginalPanelCollapsed(!isOriginalPanelCollapsed)}
                title={isOriginalPanelCollapsed ? "展开原图" : "收起原图"}
              >
                <Icon name={isOriginalPanelCollapsed ? "chevron-right" : "chevron-left"} size={16} />
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
                className="image-container image-container-checker"
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
                  <div className="drop-zone-tips" onClick={e => e.stopPropagation()}>
                    <div className="drop-zone-tip">
                      <span className="drop-zone-tip-icon">⚡</span>
                      <span>单图约 1-2 秒,大图自动缩放至 4K</span>
                    </div>
                    <div className="drop-zone-tip">
                      <span className="drop-zone-tip-icon">📂</span>
                      <span>拖入多张图片自动进入批量模式</span>
                    </div>
                    <div className="drop-zone-tip">
                      <span className="drop-zone-tip-icon">⌘</span>
                      <span><kbd>⌘O</kbd> 选图 / <kbd>⌘V</kbd> 粘贴 / <kbd>?</kbd> 全部快捷键</span>
                    </div>
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

          {/* 可拖动分隔条:调整两侧 panel 比例;双击重置;原图折叠时隐藏 */}
          {!isOriginalPanelCollapsed && (
            <div
              className="workspace-splitter"
              onMouseDown={handleSplitterDown}
              onDoubleClick={handleSplitterDoubleClick}
              title="拖动调整比例,双击重置"
            />
          )}

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
                style={(() => {
                  if (bgImage) {
                    // 背景图:fillMode 决定基础 size,bgScale 在 center/repeat 模式叠加缩放;
                    // bgOffsetX/Y 始终生效(以 % 偏移,基于 image-container 自身尺寸)
                    let size: string;
                    if (bgFillMode === 'cover') size = 'cover';
                    else if (bgFillMode === 'contain') size = 'contain';
                    else size = `${bgScale}%`; // center / repeat / custom 用 bgScale 控制
                    const posX = bgFillMode === 'repeat' ? `${bgOffsetX}px` : `calc(50% + ${bgOffsetX}%)`;
                    const posY = bgFillMode === 'repeat' ? `${bgOffsetY}px` : `calc(50% + ${bgOffsetY}%)`;
                    return {
                      backgroundColor: 'transparent',
                      backgroundImage: `url(${bgImage})`,
                      backgroundSize: size,
                      backgroundRepeat: bgFillMode === 'repeat' ? 'repeat' : 'no-repeat',
                      backgroundPosition: `${posX} ${posY}`,
                    };
                  }
                  if (bgColor === 'transparent') {
                    // 透明:显示棋盘格
                    return {
                      backgroundColor: 'transparent',
                      backgroundImage:
                        'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    };
                  }
                  // 纯色(支持 alpha)
                  return { backgroundColor: colorWithAlpha(bgColor, bgAlpha) };
                })()}
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

      {/* 导出成功后的浮动"查看"按钮 (5s 自动消失) */}
      {exported && (
        <div className="exported-pill" role="status">
          <span className="exported-pill-icon" aria-hidden="true">✓</span>
          <span className="exported-pill-text">{exported.label}</span>
          <button
            className="exported-pill-action"
            onClick={() => {
              void showItemInFolder(exported.path);
              dismissExportedPath();
            }}
          >
            去查看
          </button>
          <button
            className="exported-pill-close"
            onClick={dismissExportedPath}
            title="关闭"
            aria-label="关闭"
          >×</button>
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
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Paste Confirmation Modal */}
      {showPasteConfirm && (
        <PasteConfirmModal onConfirm={confirmPaste} onCancel={cancelPaste} />
      )}

      {/* 导出选项弹框 */}
      {showExportDialog && (
        <ExportDialog
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
          autoCrop={autoCrop}
          setAutoCrop={setAutoCrop}
          featherRadius={featherRadius}
          setFeatherRadius={setFeatherRadius}
          isOriginalGif={isOriginalGif}
          onCancel={() => setShowExportDialog(false)}
          onConfirm={async () => {
            setShowExportDialog(false);
            await handleSaveWithMask();
          }}
        />
      )}

      {/* 下载模型说明弹框 */}
      {downloadDialog && (
        <DownloadInfoModal
          info={downloadDialog}
          onClose={() => setDownloadDialog(null)}
          onToast={showToast}
        />
      )}
    </div>
  );
}

export default App;
