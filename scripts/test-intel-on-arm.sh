#!/bin/bash

# 在 ARM Mac 上使用 Rosetta 2 测试 Intel Mac 安装包
# 这可以模拟 Intel Mac 环境进行基本测试

echo "=== Intel Mac 安装包测试（通过 Rosetta 2）==="
echo ""

# 检查是否在 ARM Mac 上
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
    echo "⚠️  警告：当前系统架构是 $ARCH，不是 ARM Mac"
    echo "如果你已经在 Intel Mac 上，直接运行应用即可测试"
    exit 1
fi

echo "✅ 检测到 ARM Mac，将使用 Rosetta 2 模拟 Intel Mac"
echo ""

# 检查 Rosetta 2
if ! /usr/bin/pgrep oahd > /dev/null 2>&1; then
    echo "❌ Rosetta 2 未安装"
    echo "正在安装 Rosetta 2..."
    softwareupdate --install-rosetta --agree-to-license
    if [ $? -ne 0 ]; then
        echo "❌ Rosetta 2 安装失败"
        exit 1
    fi
fi
echo "✅ Rosetta 2 已安装"
echo ""

# 检查 DMG 文件
DMG_PATH="release/小飞AI抠图-1.0.3.dmg"
if [ ! -f "$DMG_PATH" ]; then
    echo "❌ DMG 文件不存在: $DMG_PATH"
    echo "请先构建 Intel Mac 版本"
    exit 1
fi
echo "✅ 找到 DMG 文件: $DMG_PATH"
echo ""

# 挂载 DMG
echo "1. 挂载 DMG..."
hdiutil attach "$DMG_PATH" -mountpoint /Volumes/intel-test -nobrowse
if [ $? -ne 0 ]; then
    echo "❌ 挂载失败"
    exit 1
fi
APP_PATH="/Volumes/intel-test/小飞AI抠图.app"
echo "✅ 已挂载到: $APP_PATH"
echo ""

# 检查架构
echo "2. 检查应用架构..."
APP_ARCH=$(file "$APP_PATH/Contents/MacOS/小飞AI抠图" | grep -o "x86_64\|arm64" | head -1)
echo "   应用架构: $APP_ARCH"

PYTHON_PATH="$APP_PATH/Contents/Resources/venv/bin/python3"
echo "3. 检查 Python 架构..."
file "$PYTHON_PATH"
echo ""

# 测试 Python 通过 Rosetta
echo "4. 测试 Python 通过 Rosetta 2..."
arch -x86_64 "$PYTHON_PATH" --version
if [ $? -eq 0 ]; then
    echo "✅ Python 可以运行"
else
    echo "❌ Python 运行失败"
    hdiutil detach /Volumes/intel-test
    exit 1
fi
echo ""

# 测试关键依赖
echo "5. 测试关键依赖..."
arch -x86_64 "$PYTHON_PATH" -c "
import sys
print(f'Python: {sys.version}')
print(f'Architecture: {sys.platform}')

try:
    import torch
    print(f'✅ PyTorch: {torch.__version__}')
except Exception as e:
    print(f'❌ PyTorch: {e}')

try:
    import onnxruntime
    print(f'✅ ONNX Runtime: {onnxruntime.__version__}')
except Exception as e:
    print(f'❌ ONNX Runtime: {e}')

try:
    import fastapi
    print(f'✅ FastAPI: {fastapi.__version__}')
except Exception as e:
    print(f'❌ FastAPI: {e}')

try:
    import uvicorn
    print(f'✅ Uvicorn: {uvicorn.__version__}')
except Exception as e:
    print(f'❌ Uvicorn: {e}')

try:
    import numpy
    print(f'✅ NumPy: {numpy.__version__}')
except Exception as e:
    print(f'❌ NumPy: {e}')

try:
    from PIL import Image
    print(f'✅ Pillow: OK')
except Exception as e:
    print(f'❌ Pillow: {e}')

print('')
print('依赖测试完成')
"

echo ""
echo "6. 测试后端启动..."
cd "$APP_PATH/Contents/Resources/backend"

echo "   启动后端..."
arch -x86_64 "$PYTHON_PATH" main.py &
BACKEND_PID=$!

echo "   等待 10 秒..."
sleep 10

echo ""
echo "7. 测试 API..."
curl -s http://127.0.0.1:8765/models/fixed > /tmp/test_result.json 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 后端 API 响应正常"
    echo "   模型列表:"
    cat /tmp/test_result.json | head -200
else
    echo "❌ 后端 API 无响应"
    echo "   可能原因:"
    echo "   - 依赖架构不匹配"
    echo "   - 端口被占用"
    echo "   - 后端启动失败"
fi

echo ""
echo "8. 清理..."
kill $BACKEND_PID 2>/dev/null || true
hdiutil detach /Volumes/intel-test
echo "✅ 已清理"

echo ""
echo "=== 测试完成 ==="
echo ""
echo "注意: Rosetta 2 测试只是模拟，不能完全代表真实的 Intel Mac 环境"
echo "建议在实际 Intel Mac 上进行最终测试"
