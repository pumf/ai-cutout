import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

declare global {
  interface Window {
    electronAPI: {
      selectImage: () => Promise<{ path: string; data: string; name: string } | null>;
      processImage: (imageData: string, filename: string) => Promise<string>;
      saveImage: (imageData: string) => Promise<string | null>;
      checkModelStatus: () => Promise<{ loaded: boolean; path: string }>;
    };
  }
}

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startTranslate, setStartTranslate] = useState({ x: 0, y: 0 });
  
  const originalPanelRef = useRef<HTMLDivElement>(null);
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const originalImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    checkModelStatus();
  }, []);

  const checkModelStatus = async () => {
    try {
      const status = await window.electronAPI.checkModelStatus();
      setModelStatus(status.loaded ? 'ready' : 'error');
    } catch (e) {
      setModelStatus('error');
    }
  };

  const handleSelectImage = async () => {
    const result = await window.electronAPI.selectImage();
    if (result) {
      setOriginalImage(`data:image/png;base64,${result.data}`);
      setProcessedImage(null);
      resetTransform();
    }
  };

  const handleProcess = async () => {
    if (!originalImage) return;
    
    setIsProcessing(true);
    try {
      const base64Data = originalImage.replace(/^data:image\/\w+;base64,/, '');
      const result = await window.electronAPI.processImage(base64Data, 'image.png');
      setProcessedImage(`data:image/png;base64,${result}`);
    } catch (e) {
      console.error('Processing failed:', e);
      alert('处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!processedImage) return;
    
    const base64Data = processedImage.replace(/^data:image\/\w+;base64,/, '');
    await window.electronAPI.saveImage(base64Data);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setProcessedImage(null);
        resetTransform();
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

  const resetTransform = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
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

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const panel = img.parentElement;
    if (!panel) return;
    
    const maxW = panel.clientWidth - 40;
    const maxH = panel.clientHeight - 40;
    const scaleW = maxW / img.naturalWidth;
    const scaleH = maxH / img.naturalHeight;
    const fitScale = Math.min(scaleW, scaleH, 1);
    setScale(fitScale);
    resetTransform();
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">✂️</span>
          <span className="logo-text">小飞AI抠图</span>
        </div>
        <div className="header-actions">
          <div className={`model-status ${modelStatus}`}>
            <span className="status-dot"></span>
            <span>{modelStatus === 'ready' ? '模型已就绪' : '模型加载中...'}</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="toolbar">
          <button className="btn btn-primary" onClick={handleSelectImage}>
            <span className="btn-icon">📁</span>
            选择图片
          </button>
          <button 
            className="btn btn-success" 
            onClick={handleProcess}
            disabled={!originalImage || isProcessing}
          >
            <span className="btn-icon">{isProcessing ? '⏳' : '✨'}</span>
            {isProcessing ? '处理中...' : 'AI抠图'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleSave}
            disabled={!processedImage}
          >
            <span className="btn-icon">💾</span>
            导出图片
          </button>
        </div>

        <div className="workspace">
          <div className="panel">
            <div className="panel-header">
              <span>原图</span>
            </div>
            <div 
              ref={originalPanelRef}
              className={`panel-content ${dragActive ? 'drag-active' : ''} ${isDragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !originalImage && fileInputRef.current?.click()}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setOriginalImage(event.target?.result as string);
                      setProcessedImage(null);
                      resetTransform();
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span>结果预览</span>
              {processedImage && (
                <span className="preview-badge">已处理</span>
              )}
            </div>
            <div 
              ref={resultPanelRef}
              className={`panel-content result-panel ${isDragging ? 'dragging' : ''}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div 
                className="image-container"
                style={{
                  transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`
                }}
              >
                {processedImage && (
                  <img 
                    src={processedImage} 
                    alt="Processed" 
                    className="preview-image"
                  />
                )}
              </div>
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
        <span>使用 RMBG-2.0 本地AI模型 | 保护隐私 · 离线可用</span>
      </footer>
    </div>
  );
}

export default App;
