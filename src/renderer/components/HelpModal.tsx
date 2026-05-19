interface HelpModalProps {
  appVersion: string;
  currentVersionLabel?: string;
  onClose: () => void;
  onCheckUpdate: () => void;
  onOpenExternal: (url: string) => void;
}

export function HelpModal({ appVersion, currentVersionLabel, onClose, onCheckUpdate, onOpenExternal }: HelpModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-help" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>帮助说明</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-content help-content">
          <div className="help-intro">
            <div className="help-intro-icon">
              <img src="./logo.png" alt="logo" />
            </div>
            <h2>小飞AI抠图 v{appVersion}</h2>
            <p>完全本地运行的 AI 智能抠图工具,基于 Electron + React + Python 构建,保护您的隐私。</p>
          </div>

          <div className="help-features">
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div className="feature-text">
                <h4>完全离线</h4>
                <p>所有处理均在本地完成,无需联网,保护隐私</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <div className="feature-text">
                <h4>快速高效</h4>
                <p>基于 RMBG ONNX 模型,毫秒级处理速度</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📦</div>
              <div className="feature-text">
                <h4>批量抠图</h4>
                <p>多图队列处理,可调并发,失败可重试,一键导出</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎬</div>
              <div className="feature-text">
                <h4>GIF 动图支持</h4>
                <p>逐帧抠图保留动画,可取消,支持逐帧预览</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✏️</div>
              <div className="feature-text">
                <h4>擦除修补</h4>
                <p>手动擦除/修补抠图结果,支持 100 步撤销/重做</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎨</div>
              <div className="feature-text">
                <h4>背景替换</h4>
                <p>透明 / 纯色 / 图片 / 场景预设,填充模式与透明度可调</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📂</div>
              <div className="feature-text">
                <h4>最近文件</h4>
                <p>主页底部记忆最近打开的 8 张图片,缩略图一键重开</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔍</div>
              <div className="feature-text">
                <h4>可拖拽预览</h4>
                <p>批量、GIF 帧预览窗口右下角可拖拽自由调整尺寸</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⌨️</div>
              <div className="feature-text">
                <h4>快捷键支持</h4>
                <p>丰富的键盘快捷键,提升工作效率(按 <kbd>?</kbd> 查看)</p>
              </div>
            </div>
          </div>

          <div className="help-guide">
            <h3>快速上手</h3>
            <div className="guide-steps">
              <div className="guide-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>导入图片</h4>
                  <p>点击"选择"按钮,拖拽图片到窗口,或用 <kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd> 粘贴。主页底部"最近打开"可一键复用之前的图片。支持 PNG / JPG / WebP / GIF / BMP。</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>AI 抠图</h4>
                  <p>点击"抠图"按钮或按 <kbd>⌘P</kbd> / <kbd>Ctrl+P</kbd>。首次加载模型约 1-2 秒,后续处理毫秒级。GIF 会逐帧处理并显示进度。</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>(可选) 精细编辑</h4>
                  <p>使用工具栏的擦除/修补画笔手动调整(滑杆调画笔大小)。用 <kbd>⌘Z</kbd> 撤销、<kbd>⌘⇧Z</kbd> 或 <kbd>⌘Y</kbd> 重做。</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <h4>(可选) 替换背景</h4>
                  <p>按 <kbd>⌘B</kbd> 或点击"背景"按钮,选择透明 / 纯色 / 图片 / 场景预设。<kbd>Shift+滚轮</kbd> 缩放背景图,<kbd>Shift+拖动</kbd> 平移背景图。</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">5</div>
                <div className="step-content">
                  <h4>(可选) 批量抠图</h4>
                  <p>点击"批量抠图"打开队列,拖入或选择多张图片,设置并发(1-4)和文件名前缀,点"开始处理"即可。导出后右下角会弹出"去查看"按钮直达输出目录。</p>
                </div>
              </div>
              <div className="guide-step">
                <div className="step-number">6</div>
                <div className="step-content">
                  <h4>导出结果</h4>
                  <p>点击"导出"或 <kbd>⌘S</kbd> 保存(可选格式 / 自动裁切 / 边缘羽化),或 <kbd>⌘C</kbd> 复制到剪贴板。导出成功后右下角浮动"去查看"5 秒内点击直达 Finder/Explorer。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="help-shortcuts">
            <h3>常用快捷键</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: -4, marginBottom: 12 }}>
              macOS 使用 ⌘,Windows / Linux 使用 Ctrl
            </p>
            <div className="shortcut-list">
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>O</kbd><span>选择图片</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>V</kbd><span>从剪贴板粘贴</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>P</kbd><span>AI 抠图</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>S</kbd><span>导出图片</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>C</kbd><span>复制到剪贴板</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>Z</kbd><span>撤销</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>Z</kbd><span>重做</span></div>
              <div className="shortcut-item"><kbd>⌘</kbd> + <kbd>B</kbd><span>切换背景设置</span></div>
              <div className="shortcut-item"><kbd>Shift</kbd> + 滚轮<span>缩放背景图</span></div>
              <div className="shortcut-item"><kbd>Shift</kbd> + 拖动<span>平移背景图</span></div>
              <div className="shortcut-item"><kbd>?</kbd><span>显示完整快捷键</span></div>
              <div className="shortcut-item"><kbd>Esc</kbd><span>关闭弹窗</span></div>
            </div>
          </div>

          <div className="help-faq">
            <h3>常见问题</h3>
            <div className="faq-item">
              <p className="faq-q">Q: 首次运行需要联网吗?</p>
              <p className="faq-a">A: 不需要。软件完全本地运行,内置 RMBG-1.4 模型已包含在安装包中,无需联网即可使用。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: 如何下载 RMBG-2.0 模型?</p>
              <p className="faq-a">A: 点击顶部模型名称打开列表,找到 RMBG-2.0 点击"下载",会显示下载进度。下载完成后自动切换可用。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: 支持哪些图片格式?</p>
              <p className="faq-a">A: 支持 PNG、JPG/JPEG、WebP、GIF、BMP 格式。GIF 动图会逐帧处理保留动画效果。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: 批量处理时怎么调整速度?</p>
              <p className="faq-a">A: 在批量抠图对话框底部"并发数"下拉框中可选 1-4。设备性能好(M 系列芯片 / 大内存)选 3-4 更快,普通设备建议 2。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: 导出后怎么快速找到文件?</p>
              <p className="faq-a">A: 导出成功后右下角会显示绿色浮动按钮"去查看",5 秒内点击即可在系统文件管理器中高亮该文件;5 秒不操作自动消失。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: 弹框太小看不清细节?</p>
              <p className="faq-a">A: 批量抠图、批量预览、GIF 帧预览三个弹框都支持拖拽右下角自由缩放尺寸,内容会自动适配。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: macOS 提示"无法验证开发者"怎么办?</p>
              <p className="faq-a">A: 前往 系统设置 &gt; 隐私与安全,点击"仍要打开"允许运行。这是 macOS 对未签名应用的安全提示。</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Q: 复制到剪贴板失败怎么办?</p>
              <p className="faq-a">A: GIF 格式不支持复制到剪贴板(可使用导出)。如其它格式复制失败,请检查目标应用是否支持粘贴图片。</p>
            </div>
          </div>

          <div className="help-update">
            <h3>检查更新</h3>
            <p>当前版本:v{currentVersionLabel || appVersion}</p>
            <button className="btn btn-primary" onClick={onCheckUpdate}>检查更新</button>
          </div>

          <div className="help-contact">
            <h3>开源地址</h3>
            <p>本项目已开源,欢迎 Star、Fork 和提交 PR:</p>
            <a
              className="github-link"
              href="https://github.com/pumf/ai-cutout"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                onOpenExternal('https://github.com/pumf/ai-cutout');
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>github.com/pumf/ai-cutout</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
