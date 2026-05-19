#!/bin/bash
# 把 macOS Apple framework Python 的运行时依赖 (framework lib / Python.app launcher / stdlib)
# 拷贝进 venv,让 venv 在用户机器上 self-contained,不再依赖 /Library/Developer/CommandLineTools 或 Xcode.
#
# 用法: ./scripts/bundle-venv-framework.sh <venv_path>
#
# 必要前提:
# - venv 是用 Apple 自带 /usr/bin/python3 (CLT framework Python) 创建的
# - 运行时 main.ts 通过 PYTHONHOME 把 venv 路径告诉 Python (避免去找 hostedtoolcache 路径)

set -e

VENV="${1:-}"
if [ -z "$VENV" ] || [ ! -d "$VENV" ]; then
    echo "❌ 用法: $0 <venv_path>" >&2
    exit 1
fi

# pyvenv.cfg 里的 home 指向 framework 内的 bin/
HOME_BIN=$(grep '^home = ' "$VENV/pyvenv.cfg" | sed 's/^home = //')
if [ -z "$HOME_BIN" ] || [ ! -d "$HOME_BIN" ]; then
    echo "❌ 找不到 venv 关联的 framework: $HOME_BIN" >&2
    exit 1
fi

# 用 readlink 顺藤摸瓜找到 Python.framework 根 (Versions/3.x/)
PY_VER=$(grep '^version = ' "$VENV/pyvenv.cfg" | sed 's/^version = //' | cut -d. -f1,2)
FRAMEWORK_VER=""
for cand in \
    "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/$PY_VER" \
    "/Library/Frameworks/Python.framework/Versions/$PY_VER" \
    "$HOME_BIN/../../Library/Frameworks/Python3.framework/Versions/$PY_VER"; do
    if [ -d "$cand" ] && [ -f "$cand/Python3" -o -f "$cand/Python" ]; then
        FRAMEWORK_VER="$cand"
        break
    fi
done

if [ -z "$FRAMEWORK_VER" ]; then
    echo "❌ 找不到 Python framework (查找路径见脚本)" >&2
    exit 1
fi

echo "✓ Framework: $FRAMEWORK_VER"

# 1. framework lib (bin/python3 通过 @executable_path/../Python3 加载)
PY_LIB="$FRAMEWORK_VER/Python3"
[ -f "$PY_LIB" ] || PY_LIB="$FRAMEWORK_VER/Python"
cp "$PY_LIB" "$VENV/Python3"
echo "✓ 复制 framework lib → $VENV/Python3"

# 2. Resources/Python.app launcher (启动期 posix_spawn 需要)
cp -R "$FRAMEWORK_VER/Resources" "$VENV/Resources"
echo "✓ 复制 Resources/Python.app → $VENV/Resources"

# 3. stdlib (合并到现有 venv/lib/python3.x/, 不覆盖 site-packages)
STDLIB="$FRAMEWORK_VER/lib/python$PY_VER"
if [ -d "$STDLIB" ]; then
    cp -R "$STDLIB/." "$VENV/lib/python$PY_VER/"
    echo "✓ 复制 stdlib → $VENV/lib/python$PY_VER/"
else
    echo "⚠️ stdlib 路径不存在: $STDLIB"
fi

echo "✓ venv 自包含修补完成: $VENV"
