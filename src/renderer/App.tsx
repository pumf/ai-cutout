import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

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
  const [isMouseInPanel, setIsMouseInPanel] = useState(false);

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
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setOriginalImage(imageUrl);
        setProcessedImage(null);
        
        // Reset edit mode when selecting new image
        setEditMode('none');
        
        // Auto-fit image to panel - use cover mode to fill the panel
        const img = new Image();
        img.onload = () => {
          const panel = originalPanelRef.current;
          if (panel) {
            const panelW = panel.clientWidth;
            const panelH = panel.clientHeight;
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            
            // Calculate scale to cover the entire panel
            const scaleW = panelW / imgW;
            const scaleH = panelH / imgH;
            const coverScale = Math.max(scaleW, scaleH);
            
            setScale(coverScale);
            setTranslateX(0);
            setTranslateY(0);
          }
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!originalImage) return;
    
    if (modelStatus !== 'ready') {
      setShowModelSelector(true);
      alert('请先选择一个AI模型');
      return;
    }
    
    setIsProcessing(true);
    try {
      const base64Data = originalImage.replace(/^data:image\/\w+;base64,/, '');
      
      const res = await fetch('http://127.0.0.1:8765/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      
      if (!res.ok) throw new Error('处理失败');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
    } catch (e) {
      console.error('Processing failed:', e);
      alert('处理失败，请重试');
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
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setOriginalImage(imageUrl);
        setProcessedImage(null);

        // Reset edit mode when selecting new image
        setEditMode('none');

        // Auto-fit image to panel - use cover mode to fill the panel
        const img = new Image();
        img.onload = () => {
          const panel = originalPanelRef.current;
          if (panel) {
            const panelW = panel.clientWidth;
            const panelH = panel.clientHeight;
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;

            // Calculate scale to cover the entire panel
            const scaleW = panelW / imgW;
            const scaleH = panelH / imgH;
            const coverScale = Math.max(scaleW, scaleH);

            setScale(coverScale);
            setTranslateX(0);
            setTranslateY(0);
          }
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(file);
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
        const processedCtx = processedCanvas.getContext('2d');
        if (processedCtx) {
          processedCtx.clearRect(0, 0, width, height);
          processedCtx.drawImage(img, 0, 0);
        }

        // Initialize mask with gray (128 = show AI processed)
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.fillStyle = 'rgb(128, 128, 128)';
          maskCtx.fillRect(0, 0, width, height);
        }

        // Load original image
        const originalImg = new Image();
        originalImg.crossOrigin = 'anonymous';
        originalImg.onload = () => {
          const originalCtx = originalCanvas.getContext('2d');
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
            const ctx = maskCanvasRef.current.getContext('2d');
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

  // Save mask state
  const saveMaskState = () => {
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d');
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

    const outputCtx = outputCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    const originalCtx = originalCanvas.getContext('2d');
    const processedCtx = processedCanvas.getContext('2d');

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
      const ctx = maskCanvasRef.current.getContext('2d');
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
    const outputCtx = outputCanvas.getContext('2d');
    
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
      const maskCtx = maskCanvasRef.current.getContext('2d');
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
    const outputCtx = outputCanvas.getContext('2d');
    
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
      const maskCtx = maskCanvasRef.current.getContext('2d');
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

  const handleSaveWithMask = () => {
    if (!outputCanvasRef.current) return;
    const link = document.createElement('a');
    link.href = outputCanvasRef.current.toDataURL('image/png');
    link.download = 'removed_bg_edited.png';
    link.click();
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
          <button 
            className="btn btn-primary" 
            onClick={handleSelectImage}
            title="选择本地图片文件 (支持 PNG, JPG, WebP)"
          >
            <span className="btn-icon">📁</span>
            选择图片
          </button>
          <button
            className="btn btn-success"
            onClick={handleProcess}
            disabled={!originalImage || isProcessing}
            title={!originalImage ? "请先选择图片" : isProcessing ? "正在处理中..." : "使用AI模型去除背景"}
          >
            <span className="btn-icon">{isProcessing ? '⏳' : '✨'}</span>
            {isProcessing ? '处理中...' : 'AI抠图'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={processedImage ? handleSaveWithMask : handleSave}
            disabled={!processedImage}
            title={!processedImage ? "请先处理图片" : "保存处理结果为PNG图片"}
          >
            <span className="btn-icon">💾</span>
            导出图片
          </button>
          
          {/* Zoom Control Dropdown */}
          <div className="toolbar-divider" />
          <div className="zoom-control">
            <button
              className="btn btn-outline"
              onClick={() => setShowZoomDropdown(!showZoomDropdown)}
              title="设置缩放比例"
            >
              <span className="btn-icon">🔍</span>
              {Math.round(scale * 100)}%
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
          
          {processedImage && (
            <>
              <div className="toolbar-divider" />
              <button
                className={`btn ${editMode === 'erase' ? 'btn-active' : 'btn-outline'}`}
                onClick={() => setEditMode(editMode === 'erase' ? 'none' : 'erase')}
                title={editMode === 'erase' ? "退出擦除模式" : "进入擦除模式：涂抹去除未扣干净的部分"}
              >
                <span className="btn-icon">🧹</span>
                擦除
              </button>
              <button
                className={`btn ${editMode === 'restore' ? 'btn-active' : 'btn-outline'}`}
                onClick={() => setEditMode(editMode === 'restore' ? 'none' : 'restore')}
                title={editMode === 'restore' ? "退出修补模式" : "进入修补模式：涂抹恢复被误扣的背景"}
              >
                <span className="btn-icon">✏️</span>
                修补
              </button>
              <button
                className="btn btn-outline"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title={historyIndex <= 0 ? "没有可撤回的步骤" : `撤回上一步操作 (剩余${historyIndex}步)`}
              >
                <span className="btn-icon">↩️</span>
                撤回
              </button>
              {editMode !== 'none' && (
                <div className="brush-control">
                  <span className="brush-label">画笔:</span>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="brush-slider"
                  />
                  <span className="brush-value">{brushSize}px</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="workspace">
          <div className="panel">
            <div className="panel-header">
              <span>原图</span>
            </div>
            <div
              ref={originalPanelRef}
              className={`panel-content ${dragActive ? 'drag-active' : ''} ${isDragging || isOriginalDragging ? 'dragging' : ''} ${editMode !== 'none' ? 'edit-mode' : ''}`}
              style={{ cursor: editMode !== 'none' ? (isOriginalDragging ? 'grabbing' : 'none') : 'grab' }}
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
                  originalCursor.style.left = `${e.clientX - originalCursor.parentElement!.getBoundingClientRect().left}px`;
                  originalCursor.style.top = `${e.clientY - originalCursor.parentElement!.getBoundingClientRect().top}px`;
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
              onMouseEnter={() => setIsMouseInPanel(true)}
              onMouseLeave={() => {
                if (editMode === 'none') {
                  handleMouseUp();
                } else {
                  handleOriginalMouseUp();
                }
                setIsMouseInPanel(false);
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
              {editMode !== 'none' && isMouseInPanel && (
                <div
                  ref={originalCursorRef}
                  className="virtual-cursor"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: brushSize * scale,
                    height: brushSize * scale,
                    marginLeft: -(brushSize * scale) / 2,
                    marginTop: -(brushSize * scale) / 2,
                    borderColor: editMode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: editMode === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
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
                    支持 PNG、JPG、JPEG、WEBP
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>结果预览</span>
              {processedImage && (
                <>
                  <span className="preview-badge">已处理</span>
                  {editMode !== 'none' && (
                    <span className="edit-badge">{editMode === 'erase' ? '擦除模式' : '修补模式'}</span>
                  )}
                </>
              )}
            </div>
            <div
              ref={resultPanelRef}
              className={`panel-content result-panel ${isDragging ? 'dragging' : ''} ${editMode !== 'none' ? 'edit-mode' : ''}`}
              style={{ cursor: editMode !== 'none' ? 'default' : 'grab' }}
              onMouseDown={editMode === 'none' ? handleMouseDown : handleDrawStart}
              onMouseMove={editMode === 'none' ? handleMouseMove : (e) => {
                handleDrawMove(e);
                // Update both cursors simultaneously
                const resultCursor = resultCursorRef.current;
                const originalCursor = originalCursorRef.current;
                if (resultCursor) {
                  resultCursor.style.left = `${e.clientX - resultCursor.parentElement!.getBoundingClientRect().left}px`;
                  resultCursor.style.top = `${e.clientY - resultCursor.parentElement!.getBoundingClientRect().top}px`;
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
              }}
              onMouseUp={editMode === 'none' ? handleMouseUp : handleDrawEnd}
              onMouseEnter={() => setIsMouseInPanel(true)}
              onMouseLeave={() => {
                if (editMode === 'none') {
                  handleMouseUp();
                } else {
                  handleDrawEnd();
                }
                setIsMouseInPanel(false);
              }}
            >
              <div
                className="image-container"
                style={{
                  transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`
                }}
              >
                {processedImage && (
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
              {editMode !== 'none' && isMouseInPanel && (
                <div
                  ref={resultCursorRef}
                  className="virtual-cursor"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: brushSize * scale,
                    height: brushSize * scale,
                    marginLeft: -(brushSize * scale) / 2,
                    marginTop: -(brushSize * scale) / 2,
                    borderColor: editMode === 'erase' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)',
                    backgroundColor: editMode === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
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
    </div>
  );
}

export default App;
