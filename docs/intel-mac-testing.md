# Intel Mac 版本测试方法

## 方法一：本地使用 Rosetta 2 测试（最快，但不完全准确）

在 ARM Mac 上通过 Rosetta 2 模拟 Intel Mac 环境进行基本测试。

### 步骤

1. 确保已安装 Rosetta 2（如果没有，系统会提示安装）

2. 运行测试脚本：
```bash
cd /Users/mac/Project/open_code/ai-cutout
./scripts/test-intel-on-arm.sh
```

### 测试结果说明

- ✅ **所有依赖测试通过** - 有很大概率在真实 Intel Mac 上也能工作
- ❌ **依赖测试失败** - 说明 venv 中的某些包可能不是 universal binary，需要在 Intel Mac 上重新构建
- ⚠️ **API 测试不通过** - 可能是 Rosetta 2 的兼容性问题，需要真实 Intel Mac 测试

### 局限性

**Rosetta 2 测试不能完全替代真实 Intel Mac 测试**，因为：
1. Rosetta 2 有性能开销
2. 某些底层系统调用可能行为不同
3. 无法测试所有架构特定的代码路径

---

## 方法二：GitHub Actions CI/CD（推荐，最可靠）

使用 GitHub 提供的 Intel Mac runner 自动构建和测试。

### 步骤

1. **推送代码到 GitHub**
```bash
git add -A
git commit -m "Add Intel Mac testing"
git push origin main
```

2. **在 GitHub 页面查看 Actions**
   - 打开 https://github.com/pumf/ai-cutout/actions
   - 找到 "Build and Test Intel Mac Version" 工作流
   - 等待运行完成

3. **下载构建产物**
   - Actions 运行完成后，在页面底部找到 "Artifacts"
   - 下载 "intel-mac-build" 文件
   - 解压后得到 DMG 文件

### GitHub Actions 做什么？

1. 在真实的 Intel Mac (macos-13) 上运行
2. 创建 x86_64 架构的 Python venv
3. 构建应用
4. 验证 DMG 内容
5. 测试后端能否正常启动
6. 测试 API 是否响应

### 触发方式

- **自动触发**：每次推送到 main 分支
- **手动触发**：在 GitHub Actions 页面点击 "Run workflow"

---

## 方法三：申请 GitHub Codespaces（云端 Intel Mac）

GitHub 提供云端开发环境，可以申请 Intel Mac 实例。

### 步骤

1. 打开 GitHub 仓库页面
2. 点击 "." 键或 "Code" -> "Codespaces" -> "Create codespace"
3. 选择 macOS 环境
4. 在 Codespaces 中构建和测试

---

## 方法四：找朋友/社区测试

如果以上方法都不行，可以：

1. 将 DMG 文件上传到 GitHub Release
2. 请有 Intel Mac 的朋友或社区成员帮忙测试
3. 收集日志和反馈

---

## 如何收集测试日志

如果测试者在 Intel Mac 上遇到问题，请收集以下信息：

### 1. 应用日志
```bash
cat ~/Library/Application\ Support/小飞AI抠图/logs/main.log
```

### 2. 系统信息
```bash
uname -a
sw_vers
system_profiler SPHardwareDataType
```

### 3. 手动测试后端
```bash
cd /Applications/小飞AI抠图.app/Contents/Resources
./venv/bin/python3 --version
./venv/bin/python3 -c "import torch, onnxruntime, fastapi; print('OK')"

# 启动后端
cd backend
../venv/bin/python3 main.py

# 在另一个终端测试
curl http://127.0.0.1:8765/models/fixed
```

---

## 推荐流程

**开发阶段**：
1. 本地用 Rosetta 2 快速测试（方法 1）

**发布前**：
2. 使用 GitHub Actions 自动构建（方法 2）
3. 下载 Actions 构建的 DMG 供他人测试（方法 4）

**正式发布**：
4. 如果有条件，在真实 Intel Mac 上最终验证

---

## 常见问题

### Q: Rosetta 2 测试通过了，真实 Intel Mac 会失败吗？
**A**: 有可能。Rosetta 2 只能保证基本兼容性，某些底层操作（如 SIMD 指令、特定系统调用）可能与真实 Intel Mac 不同。建议至少通过 GitHub Actions 测试。

### Q: GitHub Actions 构建的 DMG 可以直接发布吗？
**A**: 可以，但建议先在真实 Intel Mac 上验证一次，确保没有意外的环境问题。

### Q: 如果没有 Intel Mac，如何确保 100% 兼容？
**A**: 目前唯一的 100% 保证方法是使用 GitHub Actions 或类似的 CI 服务在真实 Intel Mac 上构建。CI 使用的 runner 是真实的 Intel Mac 硬件。
