#!/bin/bash

# 为 Intel Mac (x86_64) 创建 Python venv
# 这个脚本应该在构建 x64 版本前运行

echo "=== 创建 x86_64 架构的 Python venv ==="
echo ""

# 检查是否在 macOS 上
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "错误：此脚本只能在 macOS 上运行"
    exit 1
fi

# 创建 venv-x64 目录
if [ -d "venv-x64" ]; then
    echo "venv-x64 已存在，正在删除旧的 venv..."
    rm -rf venv-x64
fi

echo "1. 创建 x86_64 架构的 venv..."
# 使用 arch -x86_64 在 ARM64 Mac 上创建 x86_64 venv
# 或者直接在 Intel Mac 上创建
arch -x86_64 /usr/bin/python3 -m venv venv-x64 2>/dev/null || /usr/bin/python3 -m venv venv-x64

echo "2. 安装依赖..."
source venv-x64/bin/activate
pip install --upgrade pip
pip install torch torchvision numpy pillow onnxruntime fastapi uvicorn python-multipart python-json-logger

echo ""
echo "3. 验证安装..."
python --version
python -c "import torch; print(f'PyTorch: {torch.__version__}')"
python -c "import fastapi; print(f'FastAPI: {fastapi.__version__}')"

echo ""
echo "=== venv-x64 创建完成 ==="
echo ""
echo "现在可以构建 Intel (x64) 版本："
echo "npx electron-builder --mac --x64"
