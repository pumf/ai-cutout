#!/bin/bash
# 创建精简的 Python 运行时环境

set -e

echo "🚀 创建精简 Python 环境..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_DIR"

# 创建精简目录
rm -rf venv-minimal
mkdir -p venv-minimal/bin
mkdir -p venv-minimal/lib/python3.13/site-packages

# 复制 Python 解释器 - 使用真实文件而非符号链接
# 首先找到 Python 解释器的真实路径
PYTHON_REAL=$(readlink -f venv/bin/python3 2>/dev/null || readlink venv/bin/python3)
if [ -z "$PYTHON_REAL" ] || [ ! -f "$PYTHON_REAL" ]; then
    # 如果 readlink 失败，尝试使用 python3 命令找到实际路径
    PYTHON_REAL=$(venv/bin/python3 -c "import sys; print(sys.executable)")
fi
echo "Python 真实路径: $PYTHON_REAL"

# 复制 Python 可执行文件
cp "$PYTHON_REAL" venv-minimal/bin/python3
chmod +x venv-minimal/bin/python3
ln -sf python3 venv-minimal/bin/python

# 复制 Python3 库文件 (macOS 特有)
# Python3 库通常在可执行文件的 ../Python3 或 Frameworks 中
PYTHON_DIR=$(dirname "$PYTHON_REAL")
if [ -f "$PYTHON_DIR/../Python3" ]; then
    cp "$PYTHON_DIR/../Python3" venv-minimal/
    echo "✓ 复制 Python3 库文件"
elif [ -f "$PYTHON_DIR/Python3" ]; then
    cp "$PYTHON_DIR/Python3" venv-minimal/
    echo "✓ 复制 Python3 库文件"
fi

# 如果是 Homebrew Python，需要复制 Framework
if [[ "$PYTHON_REAL" == *"/opt/homebrew/"* ]] || [[ "$PYTHON_REAL" == *"/usr/local/"* ]]; then
    # 找到 Python.framework
    FRAMEWORK_PATH=$(find $(dirname "$PYTHON_DIR") -name "Python" -type f 2>/dev/null | head -1)
    if [ -n "$FRAMEWORK_PATH" ]; then
        mkdir -p venv-minimal/Frameworks
        cp "$FRAMEWORK_PATH" venv-minimal/Frameworks/Python 2>/dev/null || true
        echo "✓ 复制 Python Framework"
    fi
fi

# 复制必要的库（排除大而无用的）
echo "📦 复制必要的 Python 包..."

# 必须保留的包
REQUIRED_PKGS=(
  "onnxruntime"
  "numpy"
  "PIL"
  "fastapi"
  "starlette"
  "pydantic"
  "pydantic_core"
  "uvicorn"
  "click"
  "h11"
  "anyio"
  "idna"
  "packaging"
  "flatbuffers"
  "google"
  "safetensors"
  "annotated_types"
  "annotated_doc"
  "mpmath"
)

for pkg in "${REQUIRED_PKGS[@]}"; do
  if [ -d "venv/lib/python3.13/site-packages/$pkg" ]; then
    echo "  ✓ $pkg"
    cp -r "venv/lib/python3.13/site-packages/$pkg" venv-minimal/lib/python3.13/site-packages/
  fi
  # 也复制 .dist-info 目录（有些包需要）
  if [ -d "venv/lib/python3.13/site-packages/${pkg}-*.dist-info" ]; then
    cp -r "venv/lib/python3.13/site-packages/${pkg}"-*.dist-info venv-minimal/lib/python3.13/site-packages/ 2>/dev/null || true
  fi
done

# 复制 __pycache__ 和 .pyc 文件
cp -r venv/lib/python3.13/site-packages/__pycache__ venv-minimal/lib/python3.13/site-packages/ 2>/dev/null || true

# 删除不必要的文件
echo "🧹 清理不必要的文件..."

# 删除测试文件、文档、示例
find venv-minimal -type d -name "test*" -exec rm -rf {} + 2>/dev/null || true
find venv-minimal -type d -name "*test*" -exec rm -rf {} + 2>/dev/null || true
find venv-minimal -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true
find venv-minimal -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true
find venv-minimal -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# 删除 .pyc 和 .pyo 文件（保留必要的）
find venv-minimal -name "*.pyc" -delete 2>/dev/null || true
find venv-minimal -name "*.pyo" -delete 2>/dev/null || true

# 删除 .dist-info 和 .egg-info 目录（可选，但为了节省空间）
find venv-minimal -name "*.dist-info" -type d -exec rm -rf {} + 2>/dev/null || true
find venv-minimal -name "*.egg-info" -type d -exec rm -rf {} + 2>/dev/null || true

# 计算节省的空间
ORIGINAL_SIZE=$(du -sh venv | cut -f1)
MINIMAL_SIZE=$(du -sh venv-minimal | cut -f1)

echo ""
echo "✅ 精简完成！"
echo "原始大小: $ORIGINAL_SIZE"
echo "精简后: $MINIMAL_SIZE"
echo ""

# 显示节省的百分比
ORIGINAL_MB=$(du -sm venv | cut -f1)
MINIMAL_MB=$(du -sm venv-minimal | cut -f1)
SAVED_MB=$((ORIGINAL_MB - MINIMAL_MB))
SAVED_PERCENT=$((SAVED_MB * 100 / ORIGINAL_MB))

echo "节省: ${SAVED_MB}MB (${SAVED_PERCENT}%)", 