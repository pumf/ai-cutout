import { openExternalUrl } from '../../api';
import type { DownloadDialogInfo } from '../types';

interface DownloadInfoModalProps {
  info: DownloadDialogInfo;
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export function DownloadInfoModal({ info, onClose, onToast }: DownloadInfoModalProps) {
  return (
    <div className="modal-overlay modal-overlay-blocking" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>下载 {info.displayName}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content modal-body">
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
            模型文件较大,需在浏览器中手动下载。下载完成后按以下步骤加载:
          </p>
          <ol style={{ marginBottom: 20, paddingLeft: 22, lineHeight: 2, fontSize: 14 }}>
            <li>点击下方"打开下载页",在浏览器中下载 <code style={{ background: 'var(--bg-color)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 }}>model.onnx</code></li>
            <li>回到模型列表,点击该模型的"选择文件",选取刚下载的文件 — 应用会自动放置并加载</li>
          </ol>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>稍后</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await openExternalUrl(info.url);
                  onToast('已在浏览器打开下载页', 'success');
                } catch {
                  onToast('打开失败', 'error');
                }
                onClose();
              }}
            >打开下载页</button>
          </div>
        </div>
      </div>
    </div>
  );
}
