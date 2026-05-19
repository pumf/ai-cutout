#!/bin/bash
# 根据目标架构准备正确的 venv
# 用法: ./prepare-venv-for-arch.sh [x64|arm64|universal]

set -e

ARCH="${1:-arm64}"
# 解析项目根目录 = 脚本所在目录的父目录 (兼容 CI 与本地)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
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
    # venv-x64: 真正 x86_64 site-packages (在 arch -x86_64 上下文下安装)
    if [ -d "venv-x64" ]; then
        cp -r venv-x64 venv-minimal
        echo "✓ 已复制 venv-x64 (x86_64) 到 venv-minimal"
    else
        echo "❌ 错误: venv-x64 不存在,请先运行 ./scripts/prepare-x64-venv.sh"
        mv venv-minimal-backup venv-minimal
        exit 1
    fi
elif [ "$ARCH" = "arm64" ]; then
    # venv-arm64: arm64 native site-packages
    if [ -d "venv-arm64" ]; then
        cp -r venv-arm64 venv-minimal
        echo "✓ 已复制 venv-arm64 (arm64) 到 venv-minimal"
    else
        echo "❌ 错误: venv-arm64 不存在"
        mv venv-minimal-backup venv-minimal
        exit 1
    fi
else
    # Universal/默认 - 用 x64 (Universal Binary Python,site-packages 是 x86_64)
    if [ -d "venv-x64" ]; then
        cp -r venv-x64 venv-minimal
        echo "✓ 已复制 venv-x64 到 venv-minimal"
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
