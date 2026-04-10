interface TitleBarProps {
  currentModel: any;
  modelStatus: 'loading' | 'ready' | 'error';
  onShowModelSelector: () => void;
  onShowHelp: () => void;
}

export function TitleBar({ currentModel, modelStatus, onShowModelSelector, onShowHelp }: TitleBarProps) {
  return (
    <div className="titlebar">
      <div className="titlebar-content">
        {/* 左侧：留出空间给 macOS 原生红绿灯按钮 */}
        <div className="titlebar-left" style={{ width: '80px', flexShrink: 0 }} />
        
        {/* 中间：标题 */}
        <div className="titlebar-center-group">
          <img className="titlebar-logo" src="./logo.png" alt="logo" />
          <span className="titlebar-title-text">小飞AI抠图</span>
        </div>
        
        {/* 右侧：模型选择和帮助按钮 */}
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
