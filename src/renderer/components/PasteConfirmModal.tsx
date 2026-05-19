interface PasteConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function PasteConfirmModal({ onConfirm, onCancel }: PasteConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>替换图片</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-content">
          <p>当前已有图片，是否替换为新图片？</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            当前操作将丢失未保存的编辑内容
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button className="btn btn-primary" onClick={onConfirm}>确认替换</button>
          </div>
        </div>
      </div>
    </div>
  );
}
