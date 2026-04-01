#!/bin/bash
# 创建精简的 Python 运行时环境

set -e

echo "🚀 创建精简 Python 环境..."

PROJECT_DIR="/Users/mac/Project/open_code/ai-cutout"
cd "$PROJECT_DIR"

# 创建精简目录
rm -rf venv-minimal
mkdir -p venv-minimal/bin
mkdir -p venv-minimal/lib/python3.13/site-packages

# 复制 Python 解释器
cp venv/bin/python* venv-minimal/bin/ 2>/dev/null || true

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