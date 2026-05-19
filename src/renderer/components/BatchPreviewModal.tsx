import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

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

export function BatchPreviewModal({ task, onClose, onPrev, onNext, indexInfo }: BatchPreviewModalProps) {
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
          <div className="preview-header-left">
            <h3 title={task.fileName}>
              图片预览 - {task.fileName}
              {indexInfo && (
                <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                  ({indexInfo.current} / {indexInfo.total})
                </span>
              )}
            </h3>
            <span className="preview-scale-chip">缩放: {Math.round(scale * 100)}%</span>
          </div>
          <div className="preview-nav-buttons">
            <button
              className="preview-nav-btn"
              onClick={onPrev}
              disabled={!onPrev}
              title="上一张 (←)"
            >
              <Icon name="chevron-left" size={14} /> 上一张
            </button>
            <button
              className="preview-nav-btn"
              onClick={onNext}
              disabled={!onNext}
              title="下一张 (→)"
            >
              下一张 <Icon name="chevron-right" size={14} />
            </button>
            <button
              className="preview-nav-btn reset-btn"
              onClick={handleReset}
              title="重置缩放与位置"
            >
              <Icon name="refresh-cw" size={14} /> 重置
            </button>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
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

        {/* 可视化拖拽手柄 (右下角) */}
        <div className="modal-resize-handle" aria-hidden="true" />
      </div>
    </div>
  );
}
