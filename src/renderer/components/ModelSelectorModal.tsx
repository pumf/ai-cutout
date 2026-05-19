import type { ModelInfo, CurrentModel } from '../types';

interface ModelSelectorModalProps {
  availableModels: ModelInfo[];
  currentModel: CurrentModel | null;
  loadingModelId: string | null;
  errorModelId: string | null;
  isLoadingModel: boolean;
  onClose: () => void;
  onLoadModel: (modelId: string) => void;
  onSelectCustomModel: (modelId: string) => void;
  onDownloadModel: (url: string, modelName: string, displayName: string) => void;
}

export function ModelSelectorModal({
  availableModels,
  currentModel,
  loadingModelId,
  errorModelId,
  isLoadingModel,
  onClose,
  onLoadModel,
  onSelectCustomModel,
  onDownloadModel,
}: ModelSelectorModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal model-selector-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>选择 AI 模型</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          {availableModels.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              <p>暂无可用模型</p>
            </div>
          )}
          <div className="model-list">
            {availableModels.map((m) => {
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
                    <span className="model-size">{m.size_mb > 0 ? `${m.size_mb} MB` : '未下载'}</span>

                    {m.exists ? (
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
                          <button className="btn btn-small" onClick={() => onLoadModel(m.id)}>加载</button>
                        )}
                        {isLoaded && (
                          <button
                            className="btn btn-small btn-outline"
                            onClick={() => onSelectCustomModel(m.id)}
                            title="重新选择模型文件"
                          >
                            重选
                          </button>
                        )}
                        {m.download_url && !isLoaded && m.id !== '1.4' && (
                          <button
                            className="btn btn-small btn-link"
                            onClick={() => onDownloadModel(m.download_url!, m.name, m.display_name || m.name)}
                          >
                            下载
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {isLoading ? (
                          <span className="model-status-badge loading">
                            <span className="badge-spinner" />
                            加载中...
                          </span>
                        ) : isError ? (
                          <span className="model-status-badge error">加载失败</span>
                        ) : (
                          <button className="btn btn-small" onClick={() => onSelectCustomModel(m.id)}>
                            选择文件
                          </button>
                        )}
                        {m.download_url && m.id !== '1.4' && (
                          <button
                            className="btn btn-small btn-link"
                            onClick={() => onDownloadModel(m.download_url!, m.name, m.display_name || m.name)}
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
  );
}
