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
  
  const originalPanelRef = useRef<HTMLDivElement>(null);
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const originalImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.max(0.1, Math.min(10, prev * delta)));
    };

    const panel1 = originalPanelRef.current;
    const panel2 = resultPanelRef.current;

    panel1?.addEventListener('wheel', handleWheel, { passive: false });
    panel2?.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      panel1?.removeEventListener('wheel', handleWheel);
      panel2?.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
        setOriginalImage(event.target?.result as string);
        setProcessedImage(null);
        resetTransform();
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
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-title">小飞AI抠图</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => setShowHelp(true)} title="使用说明">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          <button className="titlebar-btn" onClick={() => window.electronAPI?.windowMinimize()} title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect y="5" width="12" height="2" fill="currentColor"/>
            </svg>
          </button>
          <button className="titlebar-btn" onClick={() => window.electronAPI?.windowMaximize()} title="最大化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button className="titlebar-btn titlebar-btn-close" onClick={() => window.electronAPI?.windowClose()} title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>
      <header className="header">
        <div className="logo">
          <span className="logo-icon">✂️</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-model" onClick={() => setShowModelSelector(true)}>
            <span className="btn-icon">🤖</span>
            {currentModel?.display_name || currentModel?.name || '选择模型'}
          </button>
          <div className={`model-status ${modelStatus}`}>
            <span className="status-dot"></span>
            <span>{modelStatus === 'ready' ? '已加载' : '未加载'}</span>
          </div>
        </div>
      </header>

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
              </div>
              <div className="help-section">
                <h4>🖱️ 图片操作</h4>
                <p>鼠标滚轮可缩放图片，按住鼠标左键可拖拽移动图片位置。</p>
              </div>
              <div className="help-section help-wechat">
                <h4>📱 联系我们</h4>
                <p>如有问题或建议，欢迎加入微信群交流：</p>
                <div className="wechat-qr">
                  <img src="./qrcode.jpg" alt="微信群二维码" />
                  <span>扫码添加微信好友，备注"抠图"入群</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                onChange={handleFileChange}
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
        <span>使用 RMBG 本地AI模型 | 保护隐私 · 离线可用</span>
      </footer>
    </div>
  );
}

export default App;
