#!/bin/bash
# 根据目标架构准备正确的 venv
# 用法: ./prepare-venv-for-arch.sh [x64|arm64|universal]

set -e

ARCH="${1:-arm64}"
PROJECT_DIR="/Users/mac/Project/open_code/ai-cutout"
cd "$PROJECT_DIR"

echo "=== 准备 $ARCH 架构的 venv ==="

# 备份当前的 venv-minimal
if [ -d "venv-minimal-backup" ]; then
    rm -rf venv-minimal-backup
fi

if [ -d "venv-minimal" ]; then
    mv venv-minimal venv-minimal-backup
    echo "✓ 已备份当前 venv-minimal"
fi

if [ "$ARCH" = "x64" ] || [ "$ARCH" = "x86_64" ]; then
    # 使用 venv-x64 (Universal Binary 支持 x86_64)
    if [ -d "venv-x64" ]; then
        cp -r venv-x64 venv-minimal
        echo "✓ 已复制 venv-x64 到 venv-minimal"
    else
        echo "❌ 错误: venv-x64 不存在，请先运行 ./scripts/prepare-x64-venv.sh"
        # 恢复备份
        mv venv-minimal-backup venv-minimal
        exit 1
    fi
elif [ "$ARCH" = "arm64" ]; then
    # 使用 venv (ARM64 native)
    echo "✓ 为 ARM64 创建精简 venv..."
    ./scripts/create-minimal-venv.sh
else
    # Universal - 使用 venv-x64 (它是 Universal Binary)
    if [ -d "venv-x64" ]; then
        cp -r venv-x64 venv-minimal
        echo "✓ 已复制 venv-x64 (Universal) 到 venv-minimal"
    else
        echo "❌ 错误: venv-x64 不存在"
        mv venv-minimal-backup venv-minimal
        exit 1
    fi
fi

# 验证架构
echo ""
echo "验证 Python 架构:"
file venv-minimal/bin/python3

echo ""
echo "=== venv 准备完成 ==="
