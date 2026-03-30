import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { GifReader, GifWriter } from 'omggif';

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
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startTranslate, setStartTranslate] = useState({ x: 0, y: 0 });

  // Edit mode states
  const [editMode, setEditMode] = useState<'none' | 'erase' | 'restore'>('none');
  const [brushSize, setBrushSize] = useState(20);
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

  // GIF processing state
  const [isGifProcessing, setIsGifProcessing] = useState(false);
  const [gifProgress, setGifProgress] = useState({ current: 0, total: 0 });
  const [isOriginalGif, setIsOriginalGif] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use refs for virtual cursor elements to avoid React re-render
  const originalCursorRef = useRef<HTMLDivElement>(null);
  const resultCursorRef = useRef<HTMLDivElement>(null);

  // Refs for smooth drawing
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Handle zoom with mouse position as anchor point - keep the point visually stationary
  const handleZoom = useCallback((e: WheelEvent, panelRef: React.RefObject<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    // Min scale 1% (0.01), max scale unlimited
    const newScale = Math.max(0.01, scale * delta);
    
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      // Mouse position relative to panel
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate the world coordinate of the mouse position before zoom
      const panelCenterX = rect.width / 2;
      const panelCenterY = rect.height / 2;
      const worldX = (mouseX - panelCenterX - translateX) / scale;
      const worldY = (mouseY - panelCenterY - translateY) / scale;
      
      // After zoom, we want the same world coordinate to be at the same screen position
      const newTranslateX = mouseX - panelCenterX - worldX * newScale;
      const newTranslateY = mouseY - panelCenterY - worldY * newScale;
      
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    }
    
    setScale(newScale);
  }, [scale, translateX, translateY]);

  // Set specific zoom scale
  const setZoomScale = (targetScale: number) => {
    const newScale = Math.max(0.01, targetScale);
    setScale(newScale);
    setTranslateX(0);
    setTranslateY(0);
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

  const loadAvailableModels = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/models/fixed');
      const data = await res.json();
      setAvailableModels(data.models || []);
      
      if (data.current_model?.loaded) {
        setCurrentModel(data.current_model);
        setModelStatus('ready');
      } else {
        setModelStatus('error');
      }
    } catch (e) {
      console.error('Failed to load models:', e);
      setModelStatus('error');
    }
  };

  const loadModel = async (path: string) => {
    setIsLoadingModel(true);
    try {
      const res = await fetch('http://127.0.0.1:8765/models/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentModel(data.model);
        setModelStatus('ready');
        setShowModelSelector(false);
        // Refresh model list
        loadAvailableModels();
      } else {
        alert('加载模型失败: ' + (data.detail || '未知错误'));
      }
    } catch (e) {
      console.error('Failed to load model:', e);
      alert('加载模型失败');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const loadFixedModel = async (modelId: string) => {
    setIsLoadingModel(true);
    try {
      const res = await fetch(`http://127.0.0.1:8765/models/load/${modelId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setCurrentModel(data.model);
        setModelStatus('ready');
        setShowModelSelector(false);
        // Refresh model list
        loadAvailableModels();
        showToast(`模型 ${data.model.display_name || data.model.name} 加载成功`, 'success');
      } else {
        showToast('加载模型失败: ' + (data.detail || '未知错误'), 'error');
      }
    } catch (e) {
      console.error('Failed to load model:', e);
      showToast('加载模型失败', 'error');
    } finally {
      setIsLoadingModel(false);
    }
  };

  const selectCustomModel = async (modelId: string) => {
    if (window.electronAPI) {
      setIsLoadingModel(true);
      try {
        const result = await window.electronAPI.selectModel();
        if (result) {
          const loadResult = await window.electronAPI.loadCustomModel(result.path, modelId);
          if (loadResult.success) {
            setCurrentModel(loadResult.model);
            setModelStatus('ready');
            loadAvailableModels();
          } else {
            alert('加载模型失败: ' + (loadResult.detail || '未知错误'));
          }
        }
      } catch (e) {
        console.error('Failed to load custom model:', e);
        alert('加载模型失败');
      } finally {
        setIsLoadingModel(false);
      }
    } else {
      alert('在打包应用中，请点击"选择文件"来选择自定义模型文件');
    }
  };

  const downloadModel = async (modelId: string) => {
    setIsLoadingModel(true);
    try {
      const res = await fetch(`http://127.0.0.1:8765/models/download/${modelId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setCurrentModel(data.model);
        setModelStatus('ready');
        setShowModelSelector(false);
        loadAvailableModels();
      } else {
        alert('下载模型失败: ' + (data.detail || '未知错误'));
      }
    } catch (e) {
      console.error('Failed to download model:', e);
      alert('下载模型失败');
    } finally {
      setIsLoadingModel(false);
    }
  };

  useEffect(() => {
    loadAvailableModels();
  }, []);

  const handleSelectImage = () => {
    // Check if there's already an image
    if (originalImage || processedImage) {
      // Clear the file input to allow re-selecting the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    fileInputRef.current?.click();
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
  const processImageFrame = async (base64Data: string): Promise<Blob> => {
    const res = await fetch('http://127.0.0.1:8765/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data })
    });
    
    if (!res.ok) throw new Error('处理失败');
    return await res.blob();
  };

  // Cancel GIF processing
  const cancelGifProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGifProcessing(false);
    setGifProgress({ current: 0, total: 0 });
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
  const processGif = async (gifBuffer: ArrayBuffer, originalUrl: string) => {
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
      
      setGifProgress({ current: 0, total: numFrames });
      
      // Create canvas for reading processed frames
      const processedCanvas = document.createElement('canvas');
      processedCanvas.width = width;
      processedCanvas.height = height;
      const processedCtx = processedCanvas.getContext('2d', { willReadFrequently: true });
      if (!processedCtx) throw new Error('无法创建 processed canvas context');
      
      // Process each frame
      const processedFrames: { indices: Uint8Array; palette: number[]; delay: number; transparentIndex: number | null }[] = [];
      
      for (let i = 0; i < numFrames; i++) {
        // Check if cancelled
        if (signal.aborted) {
          throw new Error('Cancelled');
        }
        
        setGifProgress({ current: i + 1, total: numFrames });
        
        // Decode frame info
        const frameInfo = gifReader.frameInfo(i);
        
        // Use decodeAndBlitFrameRGBA to get the complete frame
        // This method composites all previous frames up to this frame
        const pixels = new Uint8Array(width * height * 4);
        gifReader.decodeAndBlitFrameRGBA(i, pixels);
        
        // Create a fresh canvas for this frame
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
        if (!frameCtx) throw new Error('无法创建 frame canvas context');
        
        // Put pixels on canvas
        const imageData = frameCtx.createImageData(width, height);
        imageData.data.set(pixels);
        frameCtx.putImageData(imageData, 0, 0);
        
        // Convert to base64
        const frameBase64 = frameCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
        
        // Process frame
        try {
          const processedBlob = await processImageFrame(frameBase64);
          
          // Read processed image back to get pixel data
          const processedUrl = URL.createObjectURL(processedBlob);
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('处理后的图片加载失败'));
            img.src = processedUrl;
          });
          
          processedCtx.clearRect(0, 0, width, height);
          processedCtx.drawImage(img, 0, 0);
          URL.revokeObjectURL(processedUrl);
          
          // Get pixel data - create a copy to ensure we have Uint8Array
          const processedImageData = processedCtx.getImageData(0, 0, width, height);
          
          // Create palette and indexed data for GIF
          const processedPixels = new Uint8Array(processedImageData.data.length);
          processedPixels.set(processedImageData.data);
          const { palette, indices, transparentIndex } = createPalette(processedPixels);
          
          processedFrames.push({
            indices,
            palette,
            delay: frameInfo.delay,
            transparentIndex
          });
        } catch (err) {
          // Retry processing the frame instead of using original
          console.error(`第 ${i + 1} 帧处理失败，正在重试...`);
          try {
            // Retry once
            const retryBlob = await processImageFrame(frameBase64);
            const retryUrl = URL.createObjectURL(retryBlob);
            const retryImg = new Image();
            await new Promise<void>((resolve, reject) => {
              retryImg.onload = () => resolve();
              retryImg.onerror = () => reject(new Error('重试处理后的图片加载失败'));
              retryImg.src = retryUrl;
            });
            
            processedCtx.clearRect(0, 0, width, height);
            processedCtx.drawImage(retryImg, 0, 0);
            URL.revokeObjectURL(retryUrl);
            
            const retryImageData = processedCtx.getImageData(0, 0, width, height);
            const retryPixels = new Uint8Array(retryImageData.data.length);
            retryPixels.set(retryImageData.data);
            const { palette: retryPalette, indices: retryIndices, transparentIndex: retryTransparentIndex } = createPalette(retryPixels);
            
            processedFrames.push({
              indices: retryIndices,
              palette: retryPalette,
              delay: frameInfo.delay,
              transparentIndex: retryTransparentIndex
            });
            console.log(`第 ${i + 1} 帧重试成功`);
          } catch (retryErr) {
            // If retry also fails, throw error to stop processing
            throw new Error(`第 ${i + 1} 帧处理失败，已重试但仍失败`);
          }
        }
      }
      
      // Check if cancelled
      if (signal.aborted) {
        throw new Error('Cancelled');
      }
      
      if (processedFrames.length === 0) {
        throw new Error('没有成功处理任何帧');
      }
      
      // Create new GIF with larger buffer
      const estimatedSize = width * height * numFrames * 4 + 10 * 1024 * 1024;
      const outputBuffer = new Uint8Array(estimatedSize);
      
      let gifWriter;
      try {
        gifWriter = new GifWriter(outputBuffer, width, height, { loop: 0 });
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
          
          // 验证索引数据
          if (!frame.indices || frame.indices.length !== width * height) {
            throw new Error(`第 ${i + 1} 帧索引数据无效: ${frame.indices?.length} != ${width * height}`);
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
            disposal: 2  // 2 = Restore to background color - clear frame after display
          };
          
          // Add transparent index if there are transparent pixels
          if (frame.transparentIndex !== null) {
            addFrameOpts.transparent = frame.transparentIndex;
          }
          
          gifWriter.addFrame(0, 0, width, height, frame.indices, addFrameOpts);
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
      showToast('GIF 抠图完成！', 'success');
    } catch (err) {
      if ((err as Error).message === 'Cancelled') {
        return;
      }
      const errorMessage = (err as Error).message || '未知错误';
      showToast(`GIF 处理失败: ${errorMessage}`, 'error');
    } finally {
      setIsGifProcessing(false);
      setGifProgress({ current: 0, total: 0 });
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
      showToast('处理失败，请重试', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (!processedImage) return;
    
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'removed_bg.png';
    link.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (originalImage || processedImage) {
        // Show confirmation if there's already an image
        setPendingFile(file);
        setShowPasteConfirm(true);
      } else {
        // Load directly if no image exists
        loadFileImage(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(10, prev * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!originalImage && !processedImage) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartTranslate({ x: translateX, y: translateY });
  }, [originalImage, processedImage, translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslateX(startTranslate.x + (e.clientX - startPos.x));
    setTranslateY(startTranslate.y + (e.clientY - startPos.y));
  }, [isDragging, startPos, startTranslate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleImageLoad = () => {
    // Image loaded callback - scaling is already handled in file selection
    // This function is kept for compatibility but auto-fit is done earlier
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
          handleCopyToClipboard();
        }
      }
      // Ctrl/Cmd + P: Process image
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (originalImage && !isProcessing) {
          handleProcess();
        }
      }
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (historyIndex > 0) {
          handleUndo();
        }
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
  }, [originalImage, processedImage, isProcessing, historyIndex, showBgPicker]);

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
    setOriginalImage(imageUrl);
    setProcessedImage(null);
    
    // Auto-fit image to panel
    const img = new Image();
    img.onload = () => {
      const panel = originalPanelRef.current;
      if (panel) {
        const panelW = panel.clientWidth;
        const panelH = panel.clientHeight;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        
        // Calculate scale to fit image to panel (cover mode)
        const scaleX = (panelW - 40) / imgW;
        const scaleY = (panelH - 40) / imgH;
        const newScale = Math.max(scaleX, scaleY);
        
        setScale(Math.min(newScale, 1));
        setTranslateX(0);
        setTranslateY(0);
      }
      showToast('图片已粘贴', 'success');
    };
    img.src = imageUrl;
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

  // Handle mouse move in original panel to show virtual cursor in result panel
  const handleOriginalPanelMouseMove = (e: React.MouseEvent) => {
    if (editMode === 'none' || !originalPanelRef.current || !outputCanvasRef.current) return;
  };

  // Handle mouse move in result panel to show virtual cursor in original panel
  const handleResultPanelMouseMove = (e: React.MouseEvent) => {
    if (editMode === 'none' || !resultPanelRef.current || !originalPanelRef.current) return;
  };

  // Original panel drag handlers for edit mode
  const handleOriginalMouseDown = (e: React.MouseEvent) => {
    if (editMode === 'none' || !originalImage) return;
    e.preventDefault();
    e.stopPropagation();
    setIsOriginalDragging(true);
    setOriginalStartPos({ x: e.clientX, y: e.clientY });
    setOriginalStartTranslate({ x: translateX, y: translateY });
  };

  const handleOriginalMouseMove = (e: React.MouseEvent) => {
    if (!isOriginalDragging) return;
    setTranslateX(originalStartTranslate.x + (e.clientX - originalStartPos.x));
    setTranslateY(originalStartTranslate.y + (e.clientY - originalStartPos.y));
  };

  const handleOriginalMouseUp = () => {
    setIsOriginalDragging(false);
  };

  // Draw perfect smooth circle using radial gradient - like the virtual cursor
  const drawPerfectCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, isErase: boolean) => {
    ctx.save();
    
    // Create radial gradient for anti-aliased edges
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    if (isErase) {
      // For erase: solid transparent center, fading to transparent edge
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(0.85, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      // For restore: we need to blend original image with gradient alpha
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.85, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.globalCompositeOperation = 'destination-in';
    }
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  const drawOnMask = (x: number, y: number) => {
    if (!outputCanvasRef.current || !processedCanvasRef.current || !originalCanvasRef.current) return;

    const outputCanvas = outputCanvasRef.current;
    const processedCanvas = processedCanvasRef.current;
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
    if (!outputCanvasRef.current || !processedCanvasRef.current || !originalCanvasRef.current) return;

    const outputCanvas = outputCanvasRef.current;
    const processedCanvas = processedCanvasRef.current;
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
          disposal: 2  // Clear frame after display to prevent overlap
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
          const url = URL.createObjectURL(composedBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'removed_bg_edited.gif';
          link.click();
          URL.revokeObjectURL(url);
          showToast('GIF 已导出', 'success');
        } else {
          showToast('GIF 合成失败', 'error');
        }
      } else {
        // No background, export as-is
        const link = document.createElement('a');
        link.href = processedImage;
        link.download = 'removed_bg_edited.gif';
        link.click();
        showToast('GIF 已导出', 'success');
      }
      return;
    }
    
    const composedCanvas = await composeImageWithBackground();
    if (!composedCanvas) return;
    
    const link = document.createElement('a');
    link.href = composedCanvas.toDataURL('image/png');
    link.download = 'removed_bg_edited.png';
    link.click();
    showToast('图片已导出', 'success');
  };

  const handleCopyToClipboard = async () => {
    // Check if it's a GIF
    if (isOriginalGif && processedImage) {
      try {
        let blob: Blob;
        
        // Check if background should be applied
        if (bgImage || bgColor !== 'transparent') {
          showToast('正在合成背景...', 'info');
          const composedBlob = await composeGifWithBackground();
          if (!composedBlob) {
            showToast('GIF 合成失败', 'error');
            return;
          }
          blob = composedBlob;
        } else {
          const response = await fetch(processedImage);
          blob = await response.blob();
        }
        
        // Try to write as GIF first
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/gif': blob })
          ]);
          showToast('GIF 已复制到剪贴板', 'success');
        } catch (writeErr) {
          // If GIF format not supported, fall back to PNG (first frame only)
          console.warn('GIF format not supported on clipboard, falling back to PNG');
          
          // Convert first frame to PNG
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = processedImage;
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('无法创建 canvas context');
          
          // Draw background if set
          if (bgImage) {
            const bgImg = new Image();
            await new Promise<void>((resolve, reject) => {
              bgImg.onload = () => resolve();
              bgImg.onerror = reject;
              bgImg.src = bgImage;
            });
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
          } else if (bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob(async (pngBlob) => {
            if (pngBlob) {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob })
              ]);
              showToast('已复制第一帧为 PNG（动画丢失）', 'success');
            }
          }, 'image/png');
        }
      } catch (err) {
        console.error('Failed to copy GIF to clipboard:', err);
        showToast('复制失败', 'error');
      }
      return;
    }
    
    const composedCanvas = await composeImageWithBackground();
    if (!composedCanvas) return;
    
    try {
      composedCanvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('已复制到剪贴板', 'success');
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      showToast('复制失败', 'error');
    }
  };

  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-drag">
          <img className="titlebar-logo" src="./logo.png" alt="logo" />
          <span className="titlebar-title">小飞AI抠图 1.0</span>
        </div>
        <div className="titlebar-controls">
          <button 
            className="titlebar-model" 
            onClick={() => setShowModelSelector(true)}
            title="点击切换AI模型"
          >
            <span>🤖</span>
            <span>{currentModel?.display_name || currentModel?.name || '选择模型'}</span>
          </button>
          <div 
            className={`titlebar-status ${modelStatus}`}
            title={modelStatus === 'ready' ? '模型已加载，可以开始处理' : '模型未加载，请先选择模型'}
          >
            <span className="status-dot"></span>
            <span>{modelStatus === 'ready' ? '已加载' : '未加载'}</span>
          </div>
          <button className="titlebar-btn titlebar-btn-help" onClick={() => setShowHelp(true)} title="查看使用说明和常见问题">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
        </div>
      </div>

      {showModelSelector && (
        <div className="modal-overlay" onClick={() => setShowModelSelector(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>选择 AI 模型</h3>
              <button className="modal-close" onClick={() => setShowModelSelector(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="model-list">
                {availableModels.map((m) => (
                  <div 
                    key={m.id} 
                    className={`model-item ${currentModel?.path === m.path ? 'active' : ''}`}
                  >
                    <div className="model-info">
                      <span className="model-name">{m.display_name}</span>
                      <span className="model-type">{m.type.toUpperCase()}</span>
                    </div>
                    {m.exists ? (
                      <>
                        <span className="model-size">{m.size_mb} MB</span>
                        {currentModel?.path === m.path ? (
                          <span className="model-loaded-badge">已加载</span>
                        ) : (
                          <button className="btn btn-small" onClick={() => loadFixedModel(m.id)}>
                            加载
                          </button>
                        )}
                        {m.id !== '1.4' && (
                          <button className="btn btn-small btn-outline" onClick={() => selectCustomModel(m.id)}>
                            重选
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="model-actions">
                        <button className="btn btn-small" onClick={() => selectCustomModel(m.id)}>
                          选择文件
                        </button>
                        {m.download_url && (
                          <a 
                            className="btn btn-small btn-link" 
                            href={m.download_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            快捷下载
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {isLoadingModel && <div className="modal-loading">加载模型中...</div>}
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal modal-help" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>使用说明</h3>
              <button className="modal-close" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="modal-content help-content">
              <div className="help-section help-intro">
                <h4>关于小飞AI抠图</h4>
                <p>一款完全本地运行的AI抠图工具，保护您的隐私。无需联网，随时随地快速去除图片背景。</p>
              </div>
              <div className="help-section">
                <h4>📁 选择图片</h4>
                <p>点击"选择图片"按钮，或直接将图片拖拽到窗口中。支持 PNG、JPG、WebP 格式。</p>
              </div>
              <div className="help-section">
                <h4>🤖 AI 抠图</h4>
                <p>点击"AI 抠图"按钮，AI 将自动识别并去除图片背景。首次使用需要选择 AI 模型。</p>
              </div>
              <div className="help-section">
                <h4>💾 保存结果</h4>
                <p>处理完成后，点击"保存图片"按钮将结果保存到本地。</p>
              </div>
              <div className="help-section">
                <h4>🔄 切换模型</h4>
                <p>点击右上角的模型名称可切换 AI 模型。RMBG-1.4 速度快，RMBG-2.0 效果更好。</p>
                <p style={{marginTop: '8px'}}>
                  <strong>RMBG-2.0 下载地址：</strong>
                  <a 
                    href="https://modelscope.cn/models/AI-ModelScope/RMBG-2.0/resolve/master/onnx/model.onnx" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{color: '#3b82f6', marginLeft: '8px'}}
                  >
                    点击下载
                  </a>
                </p>
              </div>
              <div className="help-section">
                <h4>🖱️ 图片操作</h4>
                <p>鼠标滚轮可缩放图片，按住鼠标左键可拖拽移动图片位置。</p>
              </div>
              <div className="help-section">
                <h4>❓ 常见问题</h4>
                <div className="faq-item">
                  <p><strong>Q: 首次运行需要联网吗？</strong></p>
                  <p>A: 不需要，软件完全本地运行。首次启动时会自动加载内置的AI模型。</p>
                </div>
                <div className="faq-item">
                  <p><strong>Q: 支持批量处理吗？</strong></p>
                  <p>A: 目前版本支持单张图片处理。</p>
                </div>
                <div className="faq-item">
                  <p><strong>Q: 为什么处理速度较慢？</strong></p>
                  <p>A: 处理速度取决于电脑配置。推荐使用支持AI加速的CPU或GPU。</p>
                </div>
                <div className="faq-item">
                  <p><strong>Q: 如何切换AI模型？</strong></p>
                  <p>A: 点击右上角的模型名称，在弹出的模型选择界面中可以切换或加载自定义模型。</p>
                </div>
              </div>
              <div className="help-section help-wechat">
                <h4>📱 联系我们</h4>
                <p>如有问题或建议，欢迎加入微信群交流：</p>
                <div className="wechat-qr">
                  <div className="qr-item">
                    <img src="./grcode.jpg" alt="个人微信二维码" />
                    <span>个人微信</span>
                  </div>
                  <div className="qr-item">
                    <img src="./qrcode.jpg" alt="微信群二维码" />
                    <span>扫码入群</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="main">
        <div className="toolbar">
          {/* 主要操作组 */}
          <div className="toolbar-group">
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
                  GIF 抠图中 {Math.round((gifProgress.current / gifProgress.total) * 100)}%
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
              onClick={processedImage ? handleSaveWithMask : handleSave}
              disabled={!processedImage}
              title={!processedImage ? "请先处理图片" : "保存处理结果为PNG图片"}
            >
              <span className="btn-icon">💾</span>
              <span className="btn-text">导出</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCopyToClipboard}
              disabled={!processedImage}
              title={!processedImage ? "请先处理图片" : "复制到剪贴板"}
            >
              <span className="btn-icon">📋</span>
              <span className="btn-text">复制</span>
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
                  title={historyIndex <= 0 ? "无法撤回" : `撤回 (${historyIndex})`}
                >
                  <span className="btn-icon">↩️</span>
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
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !originalImage && fileInputRef.current?.click()}
              onMouseDown={editMode === 'none' ? handleMouseDown : handleOriginalMouseDown}
              onMouseMove={editMode === 'none' ? handleMouseMove : (e) => {
                handleOriginalPanelMouseMove(e);
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
              }}
              onMouseUp={editMode === 'none' ? handleMouseUp : handleOriginalMouseUp}
              onMouseEnter={() => setIsMouseInOriginalPanel(true)}
              onMouseLeave={() => {
                if (editMode === 'none') {
                  handleMouseUp();
                } else {
                  handleOriginalMouseUp();
                }
                setIsMouseInOriginalPanel(false);
              }}
            >
              <div
                className="image-container"
                style={{
                  transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`
                }}
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
                    width: brushSize * scale,
                    height: brushSize * scale,
                    borderColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.8)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'),
                    backgroundColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.3)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)')
                  }}
                />
              )}
              {!originalImage && (
                <div className="drop-zone">
                  <div className="drop-zone-icon">🖼️</div>
                  <div className="drop-zone-text">
                    拖拽图片到这里，或点击选择
                  </div>
                  <div className="drop-zone-hint">
                    支持 PNG、JPG、JPEG、WEBP、GIF
                  </div>
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
              onMouseDown={isOriginalGif ? handleMouseDown : (editMode === 'none' ? handleMouseDown : handleDrawStart)}
              onMouseMove={isOriginalGif ? handleMouseMove : (editMode === 'none' ? handleMouseMove : (e) => {
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
              })}
              onMouseUp={isOriginalGif ? handleMouseUp : (editMode === 'none' ? handleMouseUp : handleDrawEnd)}
              onMouseEnter={() => setIsMouseInResultPanel(true)}
              onMouseLeave={() => {
                if (editMode === 'none' || isOriginalGif) {
                  handleMouseUp();
                } else {
                  handleDrawEnd();
                }
                setIsMouseInResultPanel(false);
              }}
            >
              <div
                className="image-container"
                style={{
                  transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`,
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
                    width: brushSize * scale,
                    height: brushSize * scale,
                    borderColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.8)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)'),
                    backgroundColor: isAdjustingBrush ? 'rgba(59, 130, 246, 0.3)' : (editMode === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)')
                  }}
                />
              )}
              {!processedImage && (
                <div className="empty-result">
                  <div className="empty-icon">🎯</div>
                  <div className="empty-text">
                    {originalImage ? '点击"AI抠图"开始处理' : '请先上传图片'}
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
    </div>
  );
}

export default App;
