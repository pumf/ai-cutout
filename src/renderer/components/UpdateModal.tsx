import type { UpdateInfo } from '../types';

interface UpdateModalProps {
  info: UpdateInfo;
  onDismiss: () => void;
  onDownload: () => Promise<void> | void;
}

export function UpdateModal({ info, onDismiss, onDownload }: UpdateModalProps) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal update-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🎉 发现新版本</h3>
          <button className="modal-close" onClick={onDismiss}>×</button>
        </div>
        <div className="modal-content">
          <div className="update-info">
            <div className="version-comparison">
              <div className="version-item current">
                <span className="version-label">当前版本</span>
                <span className="version-number">v{info.currentVersion}</span>
              </div>
              <div className="version-arrow">→</div>
              <div className="version-item latest">
                <span className="version-label">最新版本</span>
                <span className="version-number">v{info.latestVersion}</span>
              </div>
            </div>
            <div className="update-message">
              <p>检测到新版本可用！建议更新以获得更好的体验。</p>
            </div>
            {info.releaseNotes && (
              <div className="update-notes">
                <h4>更新内容：</h4>
                <div
                  className="release-notes-content"
                  dangerouslySetInnerHTML={{
                    __html: info.releaseNotes
                      .replace(/#{1,6}\s(.+)/g, '<h4>$1</h4>')
                      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                      .replace(/- (.+)/g, '• $1')
                      .replace(/\n/g, '<br/>')
                      .substring(0, 2000),
                  }}
                />
              </div>
            )}
          </div>
          <div className="update-actions">
            <button className="btn btn-secondary" onClick={onDismiss}>稍后再说</button>
            <button className="btn btn-primary" onClick={onDownload}>立即下载更新</button>
          </div>
        </div>
      </div>
    </div>
  );
}
