import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
  currentModel: any;
  modelStatus: 'loading' | 'ready' | 'error';
  onShowModelSelector: () => void;
  onShowHelp: () => void;
}

export function TitleBar({ currentModel, modelStatus, onShowModelSelector, onShowHelp }: TitleBarProps) {
  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    
    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (err) {
      console.error('Drag failed:', err);
    }
  };

  const handleDoubleClick = async () => {
    try {
      const window = getCurrentWindow();
      await window.toggleMaximize();
    } catch (err) {
      console.error('Toggle maximize failed:', err);
    }
  };

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    await window.toggleMaximize();
  };

  return (
    <div className="titlebar" onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick}>
      <div className="titlebar-content">
        {/* Window Controls */}
        <div className="window-controls">
          <button className="window-btn close" onClick={handleClose} title="关闭">
            <svg viewBox="0 0 12 12" width="8" height="8">
              <path d="M6.94 6l2.87 2.87a.75.75 0 1 1-1.06 1.06L5.88 7.06 3 9.94a.75.75 0 0 1-1.06-1.06L4.82 6 1.94 3.13a.75.75 0 0 1 1.06-1.06L5.88 4.94 8.74 2.07a.75.75 0 1 1 1.06 1.06L6.94 6z"/>
            </svg>
          </button>
          <button className="window-btn minimize" onClick={handleMinimize} title="最小化">
            <svg viewBox="0 0 12 12" width="8" height="8">
              <path d="M2 6h8v1H2z"/>
            </svg>
          </button>
          <button className="window-btn maximize" onClick={handleMaximize} title="最大化">
            <svg viewBox="0 0 12 12" width="8" height="8">
              <path d="M6 2h4v4H9V3H6V2zM2 6V2h4v1H3v3H2zM6 10H2V6h1v3h3v1zM10 6v4H6V9h3V6h1z"/>
            </svg>
          </button>
        </div>

        {/* Center - Logo + Title */}
        <div className="titlebar-center-group">
          <img className="titlebar-logo" src="./logo.png" alt="logo" />
          <span className="titlebar-title-text">小飞AI抠图</span>
        </div>
        
        {/* Right - Model + Help */}
        <div className="titlebar-right">
          <button 
            className="titlebar-model-btn" 
            onClick={onShowModelSelector}
            title="点击切换AI模型"
          >
            <span className="model-icon">🤖</span>
            <span className="model-name-short">
              {currentModel?.display_name?.split(' ')[0] || currentModel?.name || '选择模型'}
            </span>
            <span className={`status-indicator ${modelStatus}`}></span>
          </button>
          <button className="titlebar-icon-btn" onClick={onShowHelp} title="帮助说明">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}