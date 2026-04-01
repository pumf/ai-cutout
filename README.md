# 小飞AI抠图

一款完全本地运行的AI智能抠图桌面应用，基于 Tauri + Rust 构建，安装包仅 170MB，保护您的隐私，无需联网即可快速去除图片背景。

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Tauri](https://img.shields.io/badge/tauri-2.0-blueviolet)
![Rust](https://img.shields.io/badge/rust-1.77+-orange)

## 下载

| 平台 | 下载地址 | 体积 |
|------|----------|------|
| macOS Apple Silicon (M1/M2/M3) | [小飞AI抠图-1.0.0-aarch64.dmg](https://github.com/pumf/ai-cutout/releases) | ~170MB |
| macOS Intel | [小飞AI抠图-1.0.0-x64.dmg](https://github.com/pumf/ai-cutout/releases) | ~170MB |
| Windows | [小飞AI抠图-1.0.0-setup.exe](https://github.com/pumf/ai-cutout/releases) | ~170MB |
| Linux | [小飞AI抠图-1.0.0.AppImage](https://github.com/pumf/ai-cutout/releases) | ~170MB |

## 软件介绍

小飞AI抠图是一款基于 AI 技术的本地化图片背景去除工具。通过内置的 RMBG-1.4 AI 模型，可以在本地完成图像分割和背景移除，无需上传图片到服务器，真正保护用户隐私。

### 核心特点

- 🖼️ **智能抠图** - AI 自动识别并去除图片背景
- 🔒 **本地运行** - 完全离线处理，保护隐私
- 🚀 **极速体验** - Tauri 构建，启动快、体积小（仅 170MB）
- 💻 **跨平台** - 支持 macOS、Windows、Linux
- 🎨 **多种格式** - 支持 PNG、JPG、WebP、GIF 等常见图片格式
- 🤖 **多模型支持** - 内置 RMBG-1.4，支持 RMBG-2.0
- 📋 **一键复制** - 处理结果可直接复制到剪贴板
- 🖌️ **背景替换** - 支持纯色背景和自定义图片背景

## 效果展示

| 功能 | 说明 |
|------|------|
| ![RMBG-1.4效果](resource/demo1.png) | RMBG-1.4 模型效果，速度快、开箱即用 |
| ![背景替换](resource/demo2.png) | 支持纯色背景和自定义图片背景 |
| ![模型管理](resource/demo3.png) | 支持切换不同 AI 模型 |

## 技术方案

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 桌面框架 | Tauri 2.0 | 轻量级、高性能、小体积 |
| 前端 | React + TypeScript + Vite | 现代化前端技术栈 |
| 后端 | Rust | 高性能系统级语言 |
| AI 推理 | ONNX Runtime (Rust) | 跨平台高性能推理 |
| 图像处理 | image crate | Rust 原生图像处理 |
| 剪贴板 | arboard | 跨平台剪贴板操作 |

### 架构对比

| 项目 | 旧版 (Electron) | 新版 (Tauri) | 优化 |
|------|-----------------|--------------|------|
| 安装包体积 | ~336 MB | ~170 MB | ↓ 49% |
| 启动速度 | 较慢 | 秒开 | 提升明显 |
| 内存占用 | 较高 | 低 | 更轻量 |
| 依赖 | Node.js + Python | 系统 WebView | 更简洁 |

### 项目结构

```
ai-cutout/
├── src/
│   ├── renderer/          # React 前端
│   ├── tauri.ts          # Tauri API 封装
│   └── types/            # 类型定义
├── src-tauri/            # Tauri + Rust 后端
│   ├── src/
│   │   ├── main.rs       # 主程序入口
│   │   └── model.rs      # AI 模型推理
│   ├── Cargo.toml        # Rust 依赖
│   ├── tauri.conf.json   # Tauri 配置
│   └── capabilities/     # 权限配置
├── backend/              # Python 后端（旧版，保留参考）
├── model_files/          # AI 模型文件
│   └── 1.4/             # RMBG-1.4 模型
├── scripts/              # 构建脚本
└── package.json          # 项目配置
```

## 功能介绍

### 1. 选择图片

- 点击"选择图片"按钮选择本地图片
- 支持拖拽图片到窗口
- 支持格式：PNG、JPG、WebP、GIF

### 2. AI 抠图

- 内置 RMBG-1.4 AI 模型，开箱即用
- 首次启动自动加载，无需手动配置
- 支持切换到 RMBG-2.0 模型（效果更好，约 1GB）

### 3. 保存与复制

- 处理完成后可导出为 PNG 格式
- 支持一键复制到剪贴板
- 保留透明背景

### 4. 背景替换

- 支持透明背景
- 支持纯色背景（白、黑、红、蓝等）
- 支持自定义图片背景

### 5. GIF 处理

- 支持 GIF 动图抠图
- 保持动画效果
- 帧-by-帧处理

### 6. 模型管理

- 自动加载内置 RMBG-1.4 模型
- 支持手动加载 RMBG-2.0 模型
- 模型状态实时显示
- 显示模型大小信息

### 7. 图片操作

- 鼠标滚轮缩放图片
- 拖拽移动图片位置
- 最小窗口限制 800x600

## 使用说明

### 安装

#### macOS

1. 下载 `小飞AI抠图-1.0.0-aarch64.dmg` (Apple Silicon) 或 `小飞AI抠图-1.0.0-x64.dmg` (Intel)
2. 打开 DMG 文件
3. 将应用拖拽到应用程序文件夹
4. 首次打开可能需要右键点击选择"打开"

#### Windows

1. 下载 `小飞AI抠图-1.0.0-setup.exe`
2. 运行安装程序
3. 按照提示完成安装

#### Linux

1. 下载 `小飞AI抠图-1.0.0.AppImage`
2. 添加执行权限：`chmod +x 小飞AI抠图-1.0.0.AppImage`
3. 运行：`./小飞AI抠图-1.0.0.AppImage`

### 快速开始

1. **启动应用** - 双击图标打开软件
2. **选择图片** - 点击"选择图片"或拖拽图片到窗口
3. **AI 抠图** - 点击"AI 抠图"按钮开始处理
4. **导出结果** - 点击"导出"保存图片，或"复制"到剪贴板

### 模型切换

1. 点击顶部状态栏的模型名称（如"RMBG-1.4 (速度快)"）
2. 在弹出的模型列表中选择：
   - **RMBG-1.4** - 内置模型，速度快，开箱即用
   - **RMBG-2.0** - 精度更高，需下载（约 1GB）
3. 点击"加载"或"选择文件"使用自定义模型

### 背景替换

1. 处理完图片后，在右侧面板选择背景类型：
   - **透明** - 保留透明背景
   - **纯色** - 选择预设颜色或自定义颜色
   - **图片** - 选择本地图片作为背景
2. 实时预览效果
3. 点击"导出"或"复制"保存结果

## 性能对比

| 模型 | 速度 | 效果 | 体积 | 适用场景 |
|------|------|------|------|----------|
| RMBG-1.4 | 快 | 良好 | ~168MB（内置）| 日常使用、快速处理 |
| RMBG-2.0 | 中等 | 更好 | ~1GB（需下载）| 对质量要求高 |

## 常见问题

**Q: 首次运行需要联网吗？**
A: 不需要。软件完全本地运行，内置 RMBG-1.4 模型已包含在安装包中。

**Q: 如何下载 RMBG-2.0 模型？**
A: 点击顶部模型名称打开模型列表，找到 RMBG-2.0，点击"快捷下载"按钮，会跳转到下载页面。下载后将 model.onnx 文件放到应用目录的 model_files/2.0/ 文件夹中。

**Q: 复制到剪贴板失败怎么办？**
A: 如果复制失败，可以使用"导出"功能将图片保存到本地，然后手动复制。某些应用可能不支持直接粘贴图片。

**Q: 支持批量处理吗？**
A: 目前版本支持单张图片处理。GIF 动图会逐帧处理。

**Q: 为什么处理速度较慢？**
A: 处理速度取决于电脑配置。首次加载模型需要一定时间，后续处理会更快。推荐使用支持 AI 加速的 CPU。

**Q: 如何切换 AI 模型？**
A: 点击右上角的模型名称，在弹出的模型选择界面中可以切换或加载自定义模型。

**Q: Windows/Linux 版本在哪里？**
A: 目前主要支持 macOS。Windows 和 Linux 版本正在开发中，敬请期待。

## 注意事项

- 首次启动时会自动加载内置 AI 模型（约需 1-2 秒）
- 处理大图片时可能需要较长时间
- 建议至少有 4GB 可用内存
- 应用最小窗口尺寸为 800x600

## 开发计划

- [ ] Windows 版本支持
- [ ] Linux 版本支持
- [ ] 批量处理功能
- [ ] 更多 AI 模型支持
- [ ] GPU 加速推理

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [RMBG](https://github.com/AbsoluteAI/RMBG) - AI 抠图模型
- [ONNX Runtime](https://onnxruntime.ai/) - 高性能 AI 推理引擎
- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 前端 UI 框架
