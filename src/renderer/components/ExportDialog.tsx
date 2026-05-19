interface ExportDialogProps {
  outputFormat: 'png' | 'webp' | 'jpg';
  setOutputFormat: (v: 'png' | 'webp' | 'jpg') => void;
  autoCrop: boolean;
  setAutoCrop: (v: boolean) => void;
  featherRadius: number;
  setFeatherRadius: (v: number) => void;
  isOriginalGif: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ExportDialog({
  outputFormat,
  setOutputFormat,
  autoCrop,
  setAutoCrop,
  featherRadius,
  setFeatherRadius,
  isOriginalGif,
  onCancel,
  onConfirm,
}: ExportDialogProps) {
  return (
    <div className="modal-overlay modal-overlay-blocking" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>导出图片</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-content modal-body">
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              输出格式 {isOriginalGif && <span style={{ color: '#94a3b8' }}>(GIF 文件锁定为 GIF)</span>}
            </label>
            <select
              className="output-format-select"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as 'png' | 'webp' | 'jpg')}
              disabled={isOriginalGif}
              style={{ width: '100%' }}
            >
              <option value="png">PNG — 无损,支持透明</option>
              <option value="webp">WebP — 较小,支持透明</option>
              <option value="jpg">JPG — 最小,不支持透明(以白色填充)</option>
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isOriginalGif ? 'not-allowed' : 'pointer', opacity: isOriginalGif ? 0.5 : 1 }}>
              <input
                type="checkbox"
                checked={autoCrop}
                onChange={(e) => setAutoCrop(e.target.checked)}
                disabled={isOriginalGif}
              />
              <span style={{ fontSize: 14 }}>智能裁切 — 自动去除透明边,文件更小</span>
            </label>
          </div>
          <div style={{ marginBottom: 20, opacity: isOriginalGif ? 0.5 : 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ minWidth: 90, color: 'var(--text-secondary)', fontSize: 13 }}>边缘羽化</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={featherRadius}
                onChange={(e) => setFeatherRadius(Number(e.target.value))}
                disabled={isOriginalGif}
                style={{ flex: 1 }}
                title="0 = 关闭,数值越大边缘越柔和"
              />
              <span style={{ minWidth: 40, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                {featherRadius === 0 ? '关' : `${featherRadius}px`}
              </span>
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button className="btn btn-primary" onClick={onConfirm}>导出</button>
          </div>
        </div>
      </div>
    </div>
  );
}
