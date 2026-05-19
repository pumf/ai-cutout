import { useState } from 'react';
import { Icon } from './Icon';
import { checkForUpdates } from '../../api';
import { useModelDownload, formatBytes, formatSpeed } from '../hooks/useModelDownload';
import type { ModelInfo, CurrentModel, UpdateInfo } from '../types';

type Tab = 'models' | 'about';

interface SettingsModalProps {
  onClose: () => void;
  appVersion: string;
  availableModels: ModelInfo[];
  currentModel: CurrentModel | null;
  loadingModelId: string | null;
  errorModelId: string | null;
  onLoadModel: (modelId: string) => void;
  onSelectCustomModel: (modelId: string) => void;
  onRefreshModels: () => Promise<void> | void;
  onToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  onOpenExternal: (url: string) => void;
  onUpdateAvailable?: (info: UpdateInfo) => void;
}

export function SettingsModal({
  onClose,
  appVersion,
  availableModels,
  currentModel,
  loadingModelId,
  errorModelId,
  onLoadModel,
  onSelectCustomModel,
  onRefreshModels,
  onToast,
  onOpenExternal,
  onUpdateAvailable,
}: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('models');
  const [checking, setChecking] = useState(false);

  const { progress, start } = useModelDownload(async (modelId) => {
    onToast(`模型 ${modelId} 下载完成`, 'success');
    await onRefreshModels();
  });

  const handleStartDownload = async (modelId: string) => {
    try {
      const res = await start(modelId);
      if (res.already_exists) {
        onToast('该模型已存在,无需重复下载', 'info');
      } else if (res.already_running) {
        onToast('该模型正在下载中', 'info');
      } else if (res.started) {
        onToast('已开始下载,可在此查看进度', 'success');
      }
    } catch (e) {
      onToast(`启动下载失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdates();
      if (result.hasUpdate) {
        onToast('发现新版本！', 'success');
        onUpdateAvailable?.(result);
        onClose();
      } else {
        onToast('当前已是最新版本', 'success');
      }
    } catch {
      onToast('检查更新失败，请稍后重试', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>设置</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            <button
              className={`settings-nav-item ${tab === 'models' ? 'active' : ''}`}
              onClick={() => setTab('models')}
            >
              <Icon name="layers" /> 模型管理
            </button>
            <button
              className={`settings-nav-item ${tab === 'about' ? 'active' : ''}`}
              onClick={() => setTab('about')}
            >
              <Icon name="info" /> 关于
            </button>
          </nav>
          <div className="settings-content">
            {tab === 'models' && (
              <div className="settings-section">
                <div className="settings-section-header">
                  <h4>可用模型</h4>
                  <button className="btn btn-text btn-sm" onClick={() => onRefreshModels()}>刷新</button>
                </div>
                <p className="settings-hint">
                  RMBG-1.4 已内置随包发布;其它模型首次使用时点击"下载"。
                </p>
                <div className="settings-model-list">
                  {availableModels.map((m) => {
                    const isLoaded = currentModel?.path === m.path || currentModel?.name === m.name;
                    const isLoading = loadingModelId === m.id;
                    const isError = errorModelId === m.id;
                    const prog = progress[m.id];
                    const downloading = prog?.status === 'downloading' || prog?.status === 'extracting';

                    return (
                      <div key={m.id} className={`settings-model-row ${isLoaded ? 'loaded' : ''}`}>
                        <div className="settings-model-main">
                          <div className="settings-model-title">
                            <span className="settings-model-name">{m.display_name || m.name}</span>
                            {isLoaded && <span className="settings-model-badge loaded">已加载</span>}
                            {!m.exists && !downloading && <span className="settings-model-badge missing">未下载</span>}
                            {isError && <span className="settings-model-badge error">加载失败</span>}
                          </div>
                          <div className="settings-model-meta">
                            <span>{m.type?.toUpperCase()}</span>
                            <span>·</span>
                            <span>{m.size_mb > 0 ? `${m.size_mb} MB` : '未知大小'}</span>
                          </div>

                          {downloading && prog && (
                            <div className="settings-model-progress">
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${prog.percent}%` }} />
                              </div>
                              <div className="settings-model-progress-text">
                                {prog.status === 'extracting' ? (
                                  <span>解压中…</span>
                                ) : (
                                  <>
                                    <span>{prog.percent}%</span>
                                    {prog.total > 0 && <span>· {formatBytes(prog.downloaded)} / {formatBytes(prog.total)}</span>}
                                    <span>· {formatSpeed(prog.speed_bps)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {prog?.status === 'error' && prog.error && (
                            <div className="settings-model-error">下载失败: {prog.error}</div>
                          )}
                        </div>

                        <div className="settings-model-actions">
                          {m.exists ? (
                            <>
                              {!isLoaded && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => onLoadModel(m.id)}
                                  disabled={isLoading}
                                >
                                  {isLoading ? '加载中…' : '加载'}
                                </button>
                              )}
                              <button
                                className="btn btn-text btn-sm"
                                onClick={() => onSelectCustomModel(m.id)}
                                title="重选模型文件"
                              >
                                重选文件
                              </button>
                            </>
                          ) : (
                            <>
                              {m.download_url && m.id !== '1.4' && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleStartDownload(m.id)}
                                  disabled={downloading}
                                >
                                  {downloading ? '下载中…' : '下载'}
                                </button>
                              )}
                              <button
                                className="btn btn-text btn-sm"
                                onClick={() => onSelectCustomModel(m.id)}
                                title="若已手动下载,可直接选择文件"
                              >
                                选择文件
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'about' && (
              <div className="settings-section">
                <div className="about-header">
                  <img src="./logo.png" alt="logo" className="about-logo" />
                  <div>
                    <h2 className="about-name">小飞AI抠图</h2>
                    <div className="about-version">v{appVersion}</div>
                  </div>
                </div>
                <p className="about-desc">
                  完全本地运行的 AI 智能抠图工具,基于 Electron + RMBG 构建,处理过程不离开本机。
                </p>

                <div className="about-row">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleCheckUpdate}
                    disabled={checking}
                  >
                    {checking ? '检查中…' : '检查更新'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenExternal('https://github.com/pumf/ai-cutout')}
                  >
                    开源仓库
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenExternal('https://github.com/pumf/ai-cutout/issues')}
                  >
                    反馈问题
                  </button>
                </div>

                <div className="about-credits">
                  <h4>致谢</h4>
                  <ul>
                    <li><a href="#" onClick={(e) => { e.preventDefault(); onOpenExternal('https://huggingface.co/briaai/RMBG-1.4'); }}>briaai / RMBG-1.4</a> — 抠图模型</li>
                    <li><a href="#" onClick={(e) => { e.preventDefault(); onOpenExternal('https://huggingface.co/briaai/RMBG-2.0'); }}>briaai / RMBG-2.0</a> — 抠图模型</li>
                    <li><a href="#" onClick={(e) => { e.preventDefault(); onOpenExternal('https://www.electronjs.org'); }}>Electron</a></li>
                    <li><a href="#" onClick={(e) => { e.preventDefault(); onOpenExternal('https://react.dev'); }}>React</a></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
