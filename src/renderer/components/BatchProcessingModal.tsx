import { useEffect } from 'react';
import { Icon } from './Icon';
import type { BatchTask } from '../types';

interface BatchProcessingModalProps {
  tasks: BatchTask[];
  isBatchProcessing: boolean;
  batchConcurrency: number;
  setBatchConcurrency: (v: number) => void;
  batchPrefix: string;
  setBatchPrefix: (v: string) => void;
  /** ETA 计算所需信息 */
  batchStartTimeMs: number;
  etaTick: number;
  formatEta: (ms: number) => string;
  selectedTaskId?: string | null;
  onPreview: (task: BatchTask) => void;
  onAddFiles: () => void;
  onClear: () => void;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
  onExport: () => void;
  onRetry: (taskId: string) => void;
  onRemove: (taskId: string) => void;
}

export function BatchProcessingModal({
  tasks, isBatchProcessing,
  batchConcurrency, setBatchConcurrency,
  batchPrefix, setBatchPrefix,
  batchStartTimeMs, etaTick, formatEta,
  selectedTaskId,
  onPreview, onAddFiles, onClear, onClose,
  onStart, onStop, onExport, onRetry, onRemove,
}: BatchProcessingModalProps) {
  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBatchProcessing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBatchProcessing, onClose]);

  const successCount = tasks.filter(t => t.status === 'success').length;
  const errorCount = tasks.filter(t => t.status === 'error').length;
  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'processing').length;

  return (
    <div className="modal-overlay modal-overlay-blocking">
      <div className="modal modal-batch resizable-modal">
        <div className="modal-header">
          <h3>批量抠图</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content batch-content">
          {/* Stats */}
          <div className="batch-stats">
            <div className="stat-item">
              <span className="stat-value">{tasks.length}</span>
              <span className="stat-label">总文件</span>
            </div>
            <div className="stat-item success">
              <span className="stat-value">{successCount}</span>
              <span className="stat-label">成功</span>
            </div>
            <div className="stat-item error">
              <span className="stat-value">{errorCount}</span>
              <span className="stat-label">失败</span>
            </div>
            <div className="stat-item pending">
              <span className="stat-value">{pendingCount}</span>
              <span className="stat-label">待处理</span>
            </div>
          </div>

          {/* Progress */}
          {isBatchProcessing && (() => {
            const done = tasks.filter(t => t.status === 'success' || t.status === 'error').length;
            const total = tasks.length;
            const remaining = total - done;
            const elapsedMs = Date.now() - batchStartTimeMs;
            const etaMs = (done > 0 && remaining > 0)
              ? (elapsedMs / done) * remaining
              : NaN;
            void etaTick;
            return (
              <div className="batch-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(done / total) * 100}%` }} />
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
            {tasks.length === 0 ? (
              <div className="batch-empty">
                <span className="empty-icon">📁</span>
                <p>拖拽文件到此处或点击下方按钮添加</p>
                <p className="empty-hint">支持 PNG、JPG、WebP 格式（不支持 GIF）</p>
              </div>
            ) : (
              tasks.map(task => (
                <div
                  key={task.id}
                  className={`batch-item ${task.status} ${selectedTaskId === task.id ? 'selected' : ''}`}
                  onClick={() => onPreview(task)}
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
                    )}
                  </div>
                  <div className="item-actions" onClick={e => e.stopPropagation()}>
                    {task.status === 'error' && !isBatchProcessing && (
                      <button
                        className="btn-icon"
                        onClick={() => onRetry(task.id)}
                        title="重试"
                        aria-label="重试"
                      >
                        <Icon name="refresh-cw" size={13} />
                      </button>
                    )}
                    {!isBatchProcessing && (
                      <button
                        className="btn-icon"
                        onClick={() => onRemove(task.id)}
                        title="删除"
                        aria-label="删除"
                      >
                        <Icon name="trash" size={13} />
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
                onClick={onAddFiles}
                disabled={isBatchProcessing}
              >
                <Icon name="plus" size={14} /> 添加文件
              </button>
              <button
                className="btn btn-text"
                onClick={onClear}
                disabled={isBatchProcessing || tasks.length === 0}
              >
                <Icon name="trash" size={14} /> 清空列表
              </button>
            </div>
            <div className="actions-right">
              {isBatchProcessing ? (
                <button className="btn btn-danger" onClick={onStop}>
                  <Icon name="stop" size={14} /> 停止处理
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={onExport}
                    disabled={successCount === 0}
                  >
                    <Icon name="download" size={14} /> 导出全部
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={onStart}
                    disabled={tasks.length === 0 || tasks.every(t => t.status === 'success')}
                  >
                    <Icon name="play" size={14} /> 开始处理
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 可视化拖拽手柄 (右下角) */}
        <div className="modal-resize-handle" aria-hidden="true" />
      </div>
    </div>
  );
}
