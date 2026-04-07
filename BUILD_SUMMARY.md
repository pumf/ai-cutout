# 小飞AI抠图 v1.0.2 构建说明

## 已完成的构建

### ✅ macOS Apple Silicon (M1/M2/M3) - aarch64
- **文件**: `小飞AI抠图_1.0.2_aarch64.dmg`
- **大小**: 170MB
- **状态**: ✅ 本地构建完成
- **位置**: `/Users/mac/Project/open_code/ai-cutout/release-builds/`

## GitHub Actions 自动构建

### 触发方式
推送 tag `v1.0.2` 已自动触发 GitHub Actions：
```bash
git push origin v1.0.2
```

### 构建矩阵
| 平台 | 运行环境 | 架构 | 输出格式 |
|------|---------|------|----------|
| macOS Apple Silicon | macos-latest | aarch64 | .dmg |
| macOS Intel | macos-13 | x86_64 | .dmg |
| Linux | ubuntu-22.04 | x86_64 | .AppImage |
| Windows | windows-latest | x86_64 | .msi |

### 查看构建状态
访问: https://github.com/pumf/ai-cutout/actions

## 手动上传 Release

### 方法 1: 使用 GitHub CLI
```bash
# 创建 release（如果不存在）
gh release create v1.0.2 \
  --title "小飞AI抠图 v1.0.2" \
  --notes-file RELEASE_NOTES.md

# 上传 Mac M 版本
gh release upload v1.0.2 \
  release-builds/小飞AI抠图_1.0.2_aarch64.dmg
```

### 方法 2: 使用 Web 界面
1. 访问 https://github.com/pumf/ai-cutout/releases
2. 如果 v1.0.2 已存在（由 Actions 创建），点击 "Edit"
3. 如果不存在，点击 "Create a new release"
4. 上传 `小飞AI抠图_1.0.2_aarch64.dmg`
5. 等待 Actions 完成其他平台的构建并自动上传

## Release Notes 模板

```markdown
## 小飞AI抠图 v1.0.2

### 新功能
- 完全自定义标题栏，支持拖拽和双击最大化
- 窗口圆角设计（10px）
- 优化帮助说明页面，改为 GitHub 开源地址

### 优化
- 复制功能现在包含擦除/修补效果和背景合成
- 优化导出取消提示（不再显示"导出失败"）
- 擦除和修补模式下原图区域支持拖动
- 缩放时虚拟圆形光标同步缩放
- 修复拖动和缩放时的闪烁卡顿问题

### 下载
- macOS (Apple Silicon): 小飞AI抠图_1.0.2_aarch64.dmg
- macOS (Intel): 小飞AI抠图_1.0.2_x64.dmg
- Linux: 小飞AI抠图_1.0.2_amd64.AppImage
- Windows: 小飞AI抠图_1.0.2_x64.msi
```

## 注意事项

### macOS 用户
首次打开需要在 **系统设置 > 隐私与安全性** 中允许应用运行。

### 文件说明
- `.dmg` - macOS 安装包（双击挂载后拖拽安装）
- `.AppImage` - Linux 可执行文件（无需安装，chmod +x 后运行）
- `.msi` - Windows 安装程序

## 开源地址
https://github.com/pumf/ai-cutout
