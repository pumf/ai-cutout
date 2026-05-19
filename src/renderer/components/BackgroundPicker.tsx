import { forwardRef } from 'react';
import { Icon } from './Icon';
import type { BgFillMode, CustomScene } from '../types';

interface BackgroundPickerProps {
  open: boolean;
  onToggle: () => void;

  bgColor: string;
  setBgColor: (v: string) => void;
  bgImage: string | null;
  setBgImage: (v: string | null) => void;
  bgImageName: string | null;
  setBgImageName: (v: string | null) => void;

  bgFillMode: BgFillMode;
  setBgFillMode: (v: BgFillMode) => void;
  bgAlpha: number;
  setBgAlpha: (v: number) => void;
  bgScale: number;
  setBgScale: (v: number) => void;
  bgOffsetX: number;
  setBgOffsetX: (v: number) => void;
  bgOffsetY: number;
  setBgOffsetY: (v: number) => void;

  showBgAdvanced: boolean;
  setShowBgAdvanced: (v: boolean | ((prev: boolean) => boolean)) => void;

  recentColors: string[];
  addRecentColor: (color: string) => void;

  customScenes: CustomScene[];
  addingScene: boolean;
  setAddingScene: (v: boolean) => void;
  newSceneName: string;
  setNewSceneName: (v: string) => void;
  onAddCustomScene: () => void;
  onRemoveCustomScene: (color: string) => void;
}

const SCENE_PRESETS = [
  { icon: '📷', name: '证件白底', color: '#ffffff' },
  { icon: '🛒', name: '商品浅灰', color: '#f5f5f5' },
  { icon: '🎉', name: '节日红', color: '#dc2626' },
  { icon: '✨', name: '透明', color: 'transparent' },
] as const;

const COLOR_PRESETS = [
  { value: 'transparent', label: '透明' },
  { value: '#ffffff', label: '白色' },
  { value: '#000000', label: '黑色' },
  { value: '#9ca3af', label: '灰色' },
  { value: '#ef4444', label: '红色' },
  { value: '#f97316', label: '橙色' },
  { value: '#f59e0b', label: '黄色' },
  { value: '#10b981', label: '绿色' },
  { value: '#06b6d4', label: '青色' },
  { value: '#3b82f6', label: '蓝色' },
  { value: '#8b5cf6', label: '紫色' },
  { value: '#ec4899', label: '粉色' },
] as const;

export const BackgroundPicker = forwardRef<HTMLDivElement, BackgroundPickerProps>(function BackgroundPicker(props, ref) {
  const {
    open, onToggle,
    bgColor, setBgColor, bgImage, setBgImage, bgImageName, setBgImageName,
    bgFillMode, setBgFillMode, bgAlpha, setBgAlpha,
    bgScale, setBgScale, bgOffsetX, setBgOffsetX, bgOffsetY, setBgOffsetY,
    showBgAdvanced, setShowBgAdvanced,
    recentColors, addRecentColor,
    customScenes, addingScene, setAddingScene, newSceneName, setNewSceneName,
    onAddCustomScene, onRemoveCustomScene,
  } = props;

  return (
    <div ref={ref} className="bg-picker">
      <button
        className="btn btn-icon-only"
        onClick={onToggle}
        title="背景"
      >
        <span className="btn-icon"><Icon name="palette" /></span>
      </button>
      {open && (
        <div className="bg-picker-dropdown">
          <div className="bg-picker-section">
            <div className="bg-picker-label">快速场景</div>
            <div className="bg-scene-presets">
              {SCENE_PRESETS.map(s => (
                <button
                  key={s.name}
                  className={`bg-scene-btn ${bgColor === s.color && !bgImage ? 'active' : ''}`}
                  onClick={() => { setBgColor(s.color); setBgImage(null); setBgImageName(null); }}
                  title={s.color === 'transparent' ? '透明背景' : s.color}
                >
                  <span className="bg-scene-icon">{s.icon}</span>
                  <span className="bg-scene-name">{s.name}</span>
                </button>
              ))}
              {customScenes.map(s => (
                <button
                  key={s.color}
                  className={`bg-scene-btn custom ${bgColor === s.color && !bgImage ? 'active' : ''}`}
                  onClick={() => { setBgColor(s.color); setBgImage(null); setBgImageName(null); }}
                  title={s.color}
                >
                  <span
                    className="bg-scene-icon"
                    style={{ background: s.color, width: 14, height: 14, borderRadius: 3, border: '1px solid rgba(0,0,0,0.1)' }}
                  />
                  <span className="bg-scene-name">{s.name}</span>
                  <span
                    className="bg-scene-remove"
                    onClick={(e) => { e.stopPropagation(); onRemoveCustomScene(s.color); }}
                    title="删除场景"
                  >×</span>
                </button>
              ))}
              {customScenes.length < 8 && (
                addingScene ? (
                  <div className="bg-scene-add-inline">
                    <input
                      type="text"
                      value={newSceneName}
                      onChange={(e) => setNewSceneName(e.target.value)}
                      placeholder="场景名称"
                      maxLength={10}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onAddCustomScene();
                        else if (e.key === 'Escape') { setAddingScene(false); setNewSceneName(''); }
                      }}
                      onBlur={() => { if (!newSceneName.trim()) setAddingScene(false); }}
                    />
                    <button onClick={onAddCustomScene} title="保存">✓</button>
                  </div>
                ) : (
                  <button
                    className="bg-scene-btn add"
                    onClick={() => setAddingScene(true)}
                    title={bgColor === 'transparent' ? '请先选颜色,再保存场景' : `保存当前颜色 ${bgColor.toUpperCase()} 为场景`}
                    disabled={bgColor === 'transparent'}
                  >
                    <span className="bg-scene-icon">+</span>
                    <span className="bg-scene-name">保存当前色</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="bg-picker-section">
            <div className="bg-picker-label">预设颜色</div>
            <div className="bg-picker-colors">
              {COLOR_PRESETS.map(preset => (
                <div
                  key={preset.value}
                  className={`bg-picker-color ${bgColor === preset.value && !bgImage ? 'active' : ''}`}
                  onClick={() => { setBgColor(preset.value); setBgImage(null); }}
                  style={preset.value !== 'transparent' ? { backgroundColor: preset.value } : undefined}
                  title={preset.label}
                >
                  {preset.value === 'transparent' && <div className="bg-color-transparent" />}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-picker-section">
            <div className="bg-picker-label">自定义颜色</div>
            <div className="bg-picker-custom-row">
              <input
                type="color"
                value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                onChange={(e) => { setBgColor(e.target.value); setBgImage(null); }}
                onBlur={(e) => addRecentColor(e.target.value)}
                className="bg-picker-color-input"
                title="拾色器"
              />
              <input
                type="text"
                value={bgColor === 'transparent' ? '' : bgColor.toUpperCase()}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === '' || raw === '#') return;
                  const hex = raw.startsWith('#') ? raw : '#' + raw;
                  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
                    setBgColor(hex.toLowerCase());
                    setBgImage(null);
                  }
                }}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const hex = raw.startsWith('#') ? raw : '#' + raw;
                  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
                    addRecentColor(hex.toLowerCase());
                  }
                }}
                placeholder="#RRGGBB"
                className="bg-picker-hex-input"
                spellCheck={false}
                maxLength={7}
                title="可粘贴 hex 色值,如 #3B82F6"
              />
            </div>
            {recentColors.length > 0 && (
              <>
                <div className="bg-picker-sublabel">最近使用</div>
                <div className="bg-picker-colors">
                  {recentColors.map(c => (
                    <div
                      key={c}
                      className={`bg-picker-color ${bgColor === c && !bgImage ? 'active' : ''}`}
                      onClick={() => { setBgColor(c); setBgImage(null); }}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </>
            )}
            {bgColor !== 'transparent' && !bgImage && (
              <div className="bg-picker-slider-row">
                <span className="bg-picker-slider-label">不透明度</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={bgAlpha}
                  onChange={(e) => setBgAlpha(Number(e.target.value))}
                  className="bg-picker-slider"
                />
                <span className="bg-picker-slider-value">{bgAlpha}%</span>
              </div>
            )}
          </div>

          <div className="bg-picker-section">
            <div className="bg-picker-label">背景图片</div>
            {bgImage ? (
              <>
                <div className="bg-image-preview">
                  <img src={bgImage} alt={bgImageName || '背景图'} className="bg-image-thumb" />
                  <span className="bg-image-name" title={bgImageName || ''}>
                    {bgImageName || '已选背景图'}
                  </span>
                  <button
                    className="bg-image-clear"
                    onClick={() => { setBgImage(null); setBgImageName(null); }}
                    title="清除背景图"
                  >×</button>
                </div>
                <div className="bg-shortcut-hint">
                  💡 Shift + 拖动 调背景位置 / Shift + 滚轮 调背景大小
                </div>
                <div className="bg-fill-row">
                  <span className="bg-fill-label">填充方式</span>
                  <select
                    className="bg-fill-select"
                    value={bgFillMode}
                    onChange={(e) => {
                      const v = e.target.value as BgFillMode;
                      setBgFillMode(v);
                      if (v === 'custom') setShowBgAdvanced(true);
                    }}
                  >
                    <option value="cover">填充(撑满裁剪)</option>
                    <option value="contain">适应(留边)</option>
                    <option value="center">居中原图</option>
                    <option value="repeat">平铺重复</option>
                    <option value="custom">自定义(自由调整)</option>
                  </select>
                </div>
                <button
                  className={`bg-advanced-toggle ${showBgAdvanced ? 'expanded' : ''}`}
                  onClick={() => setShowBgAdvanced(v => !v)}
                >
                  <span className="bg-advanced-toggle-arrow">▶</span>
                  位置和大小
                  {(bgScale !== 100 || bgOffsetX !== 0 || bgOffsetY !== 0) && (
                    <span style={{ marginLeft: 4, color: 'var(--primary-color)' }}>•</span>
                  )}
                </button>
                {showBgAdvanced && (
                  <>
                    {(bgFillMode === 'center' || bgFillMode === 'repeat' || bgFillMode === 'custom') && (
                      <div className="bg-picker-slider-row">
                        <span className="bg-picker-slider-label">缩放</span>
                        <input
                          type="range"
                          min={10}
                          max={300}
                          step={5}
                          value={bgScale}
                          onChange={(e) => setBgScale(Number(e.target.value))}
                          className="bg-picker-slider"
                        />
                        <span className="bg-picker-slider-value">{bgScale}%</span>
                      </div>
                    )}
                    <div className="bg-picker-slider-row">
                      <span className="bg-picker-slider-label">水平</span>
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={1}
                        value={bgOffsetX}
                        onChange={(e) => setBgOffsetX(Number(e.target.value))}
                        className="bg-picker-slider"
                      />
                      <span className="bg-picker-slider-value">{bgOffsetX > 0 ? '+' : ''}{bgOffsetX}%</span>
                    </div>
                    <div className="bg-picker-slider-row">
                      <span className="bg-picker-slider-label">垂直</span>
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={1}
                        value={bgOffsetY}
                        onChange={(e) => setBgOffsetY(Number(e.target.value))}
                        className="bg-picker-slider"
                      />
                      <span className="bg-picker-slider-value">{bgOffsetY > 0 ? '+' : ''}{bgOffsetY}%</span>
                    </div>
                    {(bgScale !== 100 || bgOffsetX !== 0 || bgOffsetY !== 0) && (
                      <button
                        className="bg-picker-reset-btn"
                        onClick={() => { setBgScale(100); setBgOffsetX(0); setBgOffsetY(0); }}
                      >重置位置和大小</button>
                    )}
                  </>
                )}
              </>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setBgImage(ev.target?.result as string);
                        setBgImageName(file.name);
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
              >
                📁 选择图片
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
