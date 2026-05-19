interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>键盘快捷键</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          <p className="shortcuts-hint">macOS 使用 ⌘,Windows / Linux 使用 Ctrl</p>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">文件</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>O</kbd><span>选择图片</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>V</kbd><span>从剪贴板粘贴</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>S</kbd><span>导出图片</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>C</kbd><span>复制到剪贴板</span></div>
            </div>
          </div>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">处理</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>P</kbd><span>AI 抠图</span></div>
            </div>
          </div>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">编辑</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>Z</kbd><span>撤销</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>Z</kbd><span>重做</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>Y</kbd><span>重做(备选)</span></div>
            </div>
          </div>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">背景</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>B</kbd><span>显示 / 隐藏背景设置</span></div>
              <div className="shortcut-item"><kbd>Shift</kbd> + 滚轮<span>缩放背景图</span></div>
              <div className="shortcut-item"><kbd>Shift</kbd> + 拖动<span>平移背景图</span></div>
            </div>
          </div>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">视图</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item">滚轮<span>缩放主图(以光标为锚点)</span></div>
              <div className="shortcut-item">拖动<span>平移主图</span></div>
            </div>
          </div>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">预览弹框(批量 / GIF 帧)</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>←</kbd> / <kbd>→</kbd><span>上一张 / 下一张</span></div>
              <div className="shortcut-item">滚轮<span>缩放预览</span></div>
              <div className="shortcut-item">拖动<span>平移预览</span></div>
              <div className="shortcut-item">拖右下角<span>调整弹框尺寸</span></div>
            </div>
          </div>

          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">通用</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item"><kbd>?</kbd><span>显示快捷键面板</span></div>
              <div className="shortcut-item"><kbd>Esc</kbd><span>关闭弹窗</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
