import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface GifFramePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  frameIndex: number | null;
  originalFrames: string[];
  processedFrames: string[];
}

export function GifFramePreviewModal({ isOpen, onClose, frameIndex, originalFrames, processedFrames }: GifFramePreviewModalProps) {
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

  const resetView = () => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const goToPrevFrame = () => {
    setCurrentIndex((prev: number) => (prev > 0 ? prev - 1 : totalFrames - 1));
    resetView();
  };

  const goToNextFrame = () => {
    setCurrentIndex((prev: number) => (prev < totalFrames - 1 ? prev + 1 : 0));
    resetView();
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentIndex, totalFrames]);

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
      <div className="modal modal-gif-frame resizable-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="preview-header-left">
            <h3>第 {currentIndex + 1} / {totalFrames} 帧</h3>
            <span className="preview-scale-chip">缩放: {Math.round(scale * 100)}%</span>
          </div>
          <div className="preview-nav-buttons">
            <button
              className="preview-nav-btn"
              onClick={goToPrevFrame}
              title="上一帧 (↑/←)"
            >
              <Icon name="chevron-left" size={14} /> 上一帧
            </button>
            <button
              className="preview-nav-btn"
              onClick={goToNextFrame}
              title="下一帧 (↓/→)"
            >
              下一帧 <Icon name="chevron-right" size={14} />
            </button>
            <button
              className="preview-nav-btn reset-btn"
              onClick={resetView}
              title="重置视图"
            >
              <Icon name="refresh-cw" size={14} /> 重置
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

        {/* 可视化拖拽手柄 (右下角) */}
        <div className="modal-resize-handle" aria-hidden="true" />
      </div>
    </div>
  );
}
