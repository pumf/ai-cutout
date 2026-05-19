# 小飞AI抠图

一款完全本地运行的AI智能抠图桌面应用，基于 Electron + React 构建，安装包仅 300MB，保护您的隐私，无需联网即可快速去除图片背景。

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Version](https://img.shields.io/badge/version-1.0.3-green)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Electron](https://img.shields.io/badge/electron-28.x-blueviolet)
![React](https://img.shields.io/badge/react-18.x-61DAFB)

## 下载

| 平台 | 下载地址 | 体积 |
|------|----------|------|
| macOS Apple Silicon (M1/M2/M3) | [小飞AI抠图-1.0.3-arm64.dmg](https://github.com/pumf/ai-cutout/releases) | ~311MB |
| macOS Intel | [小飞AI抠图-1.0.3-x64.dmg](https://github.com/pumf/ai-cutout/releases) | ~311MB |
| Windows | [小飞AI抠图-1.0.3-setup.exe](https://github.com/pumf/ai-cutout/releases) | ~311MB |
| Linux | [小飞AI抠图-1.0.3.AppImage](https://github.com/pumf/ai-cutout/releases) | ~311MB |

## 软件介绍

小飞AI抠图是一款基于 AI 技术的本地化图片背景去除工具。通过内置的 RMBG-1.4 AI 模型，可以在本地完成图像分割和背景移除，无需上传图片到服务器，真正保护用户隐私。

### 核心特点

- 🖼️ **智能抠图** - AI 自动识别并去除图片背景
- 🔒 **本地运行** - 完全离线处理，保护隐私
- 🚀 **稳定体验** - Electron 构建，成熟稳定、功能丰富
- 💻 **跨平台** - 支持 macOS、Windows、Linux
- 🎨 **多种格式** - 支持 PNG、JPG、WebP、GIF 等常见图片格式
- 🤖 **多模型支持** - 内置 RMBG-1.4、可下载 RMBG-2.0、支持自定义 ONNX 模型
- 📦 **批量抠图** - 多图队列处理,并发可调,支持单条重试与一键导出
- 🎬 **GIF 支持** - 逐帧处理 GIF 动图,可取消,可逐帧预览
- 🖌️ **背景替换** - 透明 / 纯色 / 图片 / 场景预设,支持填充模式与透明度
- ✏️ **擦除修补** - 手动擦除/修补抠图结果,支持 100 步撤销/重做
- 📋 **一键复制** - 处理结果可直接复制到剪贴板
- 📂 **最近文件** - 自动记录最近打开的图片,缩略图快速重开
- 🔍 **可拖拽预览** - 批量与 GIF 帧预览窗口可自由缩放尺寸

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
| 桌面框架 | Electron 28.x | 成熟稳定、功能丰富、跨平台 |
| 前端 | React 18 + TypeScript + Vite 5 | 现代化前端技术栈 |
| 后端 | Python 3.9+ + FastAPI + Uvicorn | 本地 AI 推理服务 |
| AI 推理 | ONNX Runtime (Python) | 跨平台高性能推理 |
| 图像处理 | Pillow + NumPy | Python 图像处理库 |
| GIF 解码 / 编码 | omggif (JS) | 浏览器端逐帧拆分与重组 |
| 剪贴板 | Electron `nativeImage` + Clipboard API | 原生剪贴板写入 |
| 文件管理器集成 | Electron `shell.showItemInFolder` | 导出后高亮显示文件 |
| 进程通信 | Electron IPC + contextBridge | 主进程与渲染进程安全通信 |

### 架构说明

小飞AI抠图采用 Electron 架构，结合了 Web 技术的跨平台优势和原生桌面应用的体验：

- **主进程 (Main Process)**: 负责窗口管理、系统集成、Python 后端服务管理
- **渲染进程 (Renderer Process)**: React 前端界面，负责用户交互和图片展示
- **Python 后端**: 独立的 AI 推理服务，通过本地 HTTP 与 Electron 通信

### 版本演进

| 项目 | Tauri 版 (v1.0.0) | Electron 版 (v1.0.3) | 说明 |
|------|-------------------|----------------------|------|
| 安装包体积 | ~170 MB | ~311 MB | Electron 包含 Chromium |
| 启动速度 | 秒开 | 较快 | Electron 需加载 Chromium |
| 内存占用 | 较低 | 中等 | Electron 内存开销较大 |
| 功能丰富度 | 基础功能 | 更丰富 | Electron 生态更成熟 |
| 稳定性 | 良好 | 优秀 | Electron 经过长期验证 |

### 项目结构

```
ai-cutout/
├── src/
│   ├── renderer/          # React 前端（渲染进程）
│   │   ├── components/    # React 组件
│   │   ├── App.tsx       # 主应用组件
│   │   └── main.tsx      # 渲染进程入口
│   ├── main/             # Electron 主进程
│   │   ├── main.ts       # 主进程入口
│   │   ├── preload.ts    # 预加载脚本（安全通信）
│   │   └── start.ts      # 启动逻辑
│   └── types/            # 类型定义
├── backend/              # Python AI 推理服务
│   ├── main.py           # FastAPI 服务入口
│   ├── model.py          # AI 模型推理
│   └── requirements.txt  # Python 依赖
├── model_files/          # AI 模型文件
│   └── 1.4/             # RMBG-1.4 模型
├── dist/                 # 构建输出目录
├── release/              # 打包输出目录
├── scripts/              # 构建脚本
└── package.json          # 项目配置
```

## 功能介绍

### 1. 导入图片

- 点击"选择"按钮打开系统对话框
- 直接拖拽图片到窗口任意位置
- 使用 ⌘V / Ctrl+V 从剪贴板粘贴
- 主页底部展示**最近打开**的 8 张图片(缩略图,固定宽度),点击重新打开
- 支持格式:PNG、JPG/JPEG、WebP、GIF、BMP

### 2. AI 抠图

- 内置 RMBG-1.4(约 168MB),首次启动自动加载,毫秒级处理
- 可切换 RMBG-2.0(约 1GB,精度更高),通过模型管理界面引导下载
- 支持加载用户自己的 ONNX 模型
- 顶部状态栏实时显示当前模型与加载状态

### 3. 批量抠图

- 选择多张图片或拖拽一组进入,自动加入队列
- 并发可调(1/2/3/4),根据设备性能选择
- 自定义文件名前缀
- 单条失败可重试,可逐条删除
- 实时进度条 + 剩余时间预估(ETA)
- 一键导出全部,导出成功后右下角弹出**「去查看」浮动按钮**(5 秒消失,点击直接在 Finder/Explorer 高亮)
- 批处理弹框**右下角可拖拽**自由调整宽高,内容自适应

### 4. GIF 动图抠图

- 自动逐帧解码 → AI 处理 → 重新编码,保留动画
- 处理过程可随时取消,带进度计数
- 支持**逐帧预览**:左右对比原图与处理后,滚轮缩放、拖动平移
- GIF 帧预览弹框同样**可拖拽**调整尺寸

### 5. 背景替换

- **透明** — 保留 alpha 通道(默认导出 PNG)
- **纯色** — 预设白/黑/红/蓝等 + 自定义颜色,记忆最近使用的颜色
- **自定义图片** — 选择本地图片作为背景
- **场景预设** — 一组预设场景背景,一键应用
- 填充模式:覆盖 / 包含 / 平铺 / 居中
- 背景透明度、位置偏移、缩放可调
- **Shift+滚轮** 缩放背景图,**Shift+拖动** 平移背景图(主图操作不受影响)

### 6. 画笔编辑

- **擦除**:抹掉抠图结果中多余的部分
- **修补**:从原图取回被误抠掉的细节
- 画笔大小可调(滑杆 + 实时光标预览圈)
- 100 步**撤销/重做** (⌘Z / ⌘⇧Z 或 ⌘Y)
- 棋盘格透明背景指示,确保编辑准确

### 7. 导出 / 复制

- 导出格式:PNG / JPG / WebP / GIF(GIF 保持 GIF)
- 可选**自动裁切**至内容边界,瘦身省空间
- 可选**边缘羽化**(0-10 px),消除锯齿
- 一键复制处理结果到系统剪贴板(GIF 除外)
- 导出后右下角弹出**「去查看」浮动按钮**,5 秒自动消失,点击直达 Finder/Explorer

### 8. 模型管理

- 自动加载内置 RMBG-1.4
- 支持下载 RMBG-2.0(进度可见)
- 支持选择本地 .onnx / .safetensors 自定义模型
- 模型加载状态实时显示

### 9. 视图操作

- 鼠标滚轮缩放主图(以鼠标位置为锚点)
- 鼠标拖动平移主图
- 缩放下拉菜单(10% / 25% / 50% / 75% / 100% / 150% / 200% / 适应屏幕)
- 最小窗口尺寸 900×600,可自由调整

## 使用说明

### 安装

#### macOS

1. 下载 `小飞AI抠图-1.0.3-arm64.dmg` (Apple Silicon M1/M2/M3) 或 `小飞AI抠图-1.0.3-x64.dmg` (Intel)
2. 打开 DMG 文件
3. 将应用拖拽到应用程序文件夹
4. 首次打开可能需要右键点击选择"打开"

**注意**: macOS 可能会提示"无法验证开发者"，请前往 **系统设置 > 隐私与安全** 中允许打开。

**⚠️ Intel Mac 用户注意**:
- 首次启动时如果提示"后端服务启动失败"，可能是因为内置 Python 环境与您的系统架构不匹配
- 解决方案：确保系统已安装 Python 3.9+，应用会自动尝试使用系统 Python
- 或者从源码自行构建适合 Intel 架构的版本（见下方开发指南）

#### Windows

1. 下载 `小飞AI抠图-1.0.3-setup.exe` (x64) 或 `小飞AI抠图-1.0.3-arm64.exe` (ARM64)
2. **安装 Python 3.9+**（如果尚未安装）
   - 从 [python.org](https://www.python.org/downloads/) 下载
   - **重要**: 安装时勾选 "Add Python to PATH"
3. 运行安装程序，按提示完成安装
4. 首次运行可能需要允许防火墙访问

**⚠️ Windows 用户注意**:
- 如果提示"后端服务启动失败"，请确保已正确安装 Python 并添加到 PATH
- 某些杀毒软件可能误报，请将应用添加到白名单
- 建议以管理员身份运行以确保所有功能正常

#### Linux

1. 下载 `小飞AI抠图-1.0.3.AppImage`
2. 添加执行权限：`chmod +x 小飞AI抠图-1.0.3.AppImage`
3. 运行：`./小飞AI抠图-1.0.3.AppImage`

**依赖要求**: Linux 系统需要安装 Python 3.9+ 和相关依赖（AppImage 已内置）

### 快速开始

1. **启动应用** - 双击图标打开软件
2. **导入图片** - 点击"选择"、拖拽,或使用 ⌘V 粘贴
3. **AI 抠图** - 点击"抠图"按钮或按 ⌘P 开始处理
4. **(可选) 编辑** - 用擦除/修补画笔微调,或切换背景(⌘B)
5. **(可选) 批量** - 选多张图打开"批量抠图"对话框,设置并发后开始
6. **导出结果** - 点击"导出"(⌘S)或"复制"(⌘C),导出后点右下角浮窗"去查看"直达文件

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| ⌘/Ctrl + O | 选择图片 |
| ⌘/Ctrl + V | 从剪贴板粘贴 |
| ⌘/Ctrl + P | AI 抠图 |
| ⌘/Ctrl + S | 导出(带蒙版) |
| ⌘/Ctrl + C | 复制到剪贴板 |
| ⌘/Ctrl + Z | 撤销 |
| ⌘/Ctrl + ⇧ + Z 或 ⌘/Ctrl + Y | 重做 |
| ⌘/Ctrl + B | 显示/隐藏背景设置 |
| Shift + 滚轮 | 缩放背景图 |
| Shift + 拖动 | 平移背景图 |
| ? | 显示快捷键面板 |
| Esc | 关闭弹框 |

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
A: 支持。点击工具栏的"批量抠图"打开队列,拖入多张图片或选择文件夹,可设置并发数(1-4)、文件名前缀,一键导出后会弹出"去查看"浮窗直达输出目录。

**Q: 导出后怎么快速找到文件?**
A: 单图或批量导出成功后,右下角会显示绿色浮动按钮"去查看",5 秒内点击即可在系统文件管理器中高亮该文件;5 秒不操作自动消失。

**Q: 为什么处理速度较慢？**
A: 处理速度取决于电脑配置。首次加载模型需要一定时间，后续处理会更快。推荐使用支持 AI 加速的 CPU。

**Q: 如何切换 AI 模型？**
A: 点击右上角的模型名称，在弹出的模型选择界面中可以切换或加载自定义模型。

**Q: Windows/Linux 版本在哪里？**
A: macOS / Windows / Linux 三平台均已支持,在 Releases 页面下载对应安装包即可。

## 注意事项

- 首次启动时会自动加载内置 AI 模型(约需 1-2 秒)
- 处理大图(>4K)会自动缩放到 2048px 处理,导出仍保持原尺寸比例
- 建议至少有 4GB 可用内存,批量处理时建议 8GB+
- 应用最小窗口尺寸为 900×600,预览/批量弹框可拖拽自由缩放
- GIF 处理过程为单线程,大型 GIF(几十帧 + 高分辨率)可能短暂卡顿,可随时取消

## 开发指南

### 构建不同架构的 macOS 版本

由于内置 Python 环境是架构相关的，构建不同架构的安装包需要不同的步骤：

#### 前置要求

- Node.js 18+
- Python 3.9+（用于创建 venv）

#### 构建 Apple Silicon (ARM64) 版本

```bash
npm install
npm run package:mac:arm64
```

#### 构建 Intel Mac (x64) 版本

```bash
npm install

# 首次构建前，创建 x64 架构的 venv
./scripts/prepare-x64-venv.sh

# 构建 Intel Mac 版本（会自动使用 venv-x64）
npm run package:mac:x64
```

#### 构建 Universal 版本

```bash
npm run package:mac:universal
```

### 架构说明

- `venv/` - 开发环境（ARM64）
- `venv-minimal/` - 默认打包用（ARM64，精简版）
- `venv-x64/` - Intel Mac 打包用（Universal Binary，支持 x86_64 和 arm64）

## 开发计划

- [x] macOS / Windows / Linux 跨平台支持
- [x] 手动擦除/修补画笔(含撤销/重做)
- [x] GIF 动图逐帧抠图与帧预览
- [x] 批量抠图(队列 + 并发 + ETA + 重试)
- [x] 背景替换(纯色 / 图片 / 场景预设 + 填充模式 + 透明度)
- [x] 自定义 ONNX 模型加载
- [x] 导出后浮动「去查看」(Finder/Explorer 高亮)
- [x] 可拖拽尺寸的预览弹框
- [ ] 更多 AI 模型(BiRefNet 等)
- [ ] GPU / CoreML / DirectML 加速推理
- [ ] 快捷键自定义
- [ ] 模型下载断点续传与 SHA 校验
- [ ] Web Worker 化 GIF 处理(消除 UI 卡顿)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 致谢

- [RMBG](https://github.com/AbsoluteAI/RMBG) - AI 抠图模型
- [ONNX Runtime](https://onnxruntime.ai/) - 高性能 AI 推理引擎
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 前端 UI 框架
- [FastAPI](https://fastapi.tiangolo.com/) - Python Web 框架
