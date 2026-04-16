#!/bin/bash

# 诊断脚本：测试 Intel Mac 上的 Python 后端是否能启动

echo "=== 小飞 AI 抠图 - Intel Mac 诊断脚本 ==="
echo ""

# 检查系统架构
echo "1. 检查系统架构..."
ARCH=$(uname -m)
echo "   系统架构: $ARCH"

if [ "$ARCH" != "x86_64" ]; then
    echo "   ⚠️  警告：当前不是 Intel Mac (x86_64)，而是 $ARCH"
    echo "   此脚本专为 Intel Mac 设计"
fi

echo ""
echo "2. 检查应用路径..."
APP_PATH="/Applications/小飞AI抠图.app"
if [ ! -d "$APP_PATH" ]; then
    echo "   ❌ 错误：应用未安装到 $APP_PATH"
    echo "   请先安装应用"
    exit 1
fi
echo "   ✅ 应用已安装"

echo ""
echo "3. 检查 Resources 目录..."
RESOURCES_PATH="$APP_PATH/Contents/Resources"
if [ ! -d "$RESOURCES_PATH" ]; then
    echo "   ❌ 错误：Resources 目录不存在"
    exit 1
fi
echo "   ✅ Resources 目录存在"

echo ""
echo "4. 检查 venv-x64..."
VENV_PATH="$RESOURCES_PATH/venv-x64"
if [ ! -d "$VENV_PATH" ]; then
    echo "   ❌ 错误：venv-x64 不存在"
    echo "   可能安装的是旧版本"
    
    # 检查是否有 venv
    if [ -d "$RESOURCES_PATH/venv" ]; then
        echo "   ⚠️  发现 venv 目录（可能是 ARM64 版本）"
        file "$RESOURCES_PATH/venv/bin/python3"
    fi
    exit 1
fi
echo "   ✅ venv-x64 存在"

echo ""
echo "5. 检查 Python 可执行文件..."
PYTHON_PATH="$VENV_PATH/bin/python3"
if [ ! -f "$PYTHON_PATH" ]; then
    echo "   ❌ 错误：Python 可执行文件不存在"
    exit 1
fi
echo "   ✅ Python 可执行文件存在"
echo "   Python 信息:"
file "$PYTHON_PATH"

echo ""
echo "6. 测试 Python 版本..."
"$PYTHON_PATH" --version
if [ $? -ne 0 ]; then
    echo "   ❌ 错误：无法运行 Python"
    exit 1
fi
echo "   ✅ Python 可以正常运行"

echo ""
echo "7. 检查 Python 依赖..."
echo "   检查关键依赖包..."
"$PYTHON_PATH" -c "import torch; print(f'  ✅ PyTorch: {torch.__version__}')" 2>&1
if [ $? -ne 0 ]; then
    echo "   ❌ PyTorch 未安装"
fi

"$PYTHON_PATH" -c "import onnxruntime; print(f'  ✅ ONNX Runtime: {onnxruntime.__version__}')" 2>&1
if [ $? -ne 0 ]; then
    echo "   ❌ ONNX Runtime 未安装"
fi

"$PYTHON_PATH" -c "import fastapi; print(f'  ✅ FastAPI: {fastapi.__version__}')" 2>&1
if [ $? -ne 0 ]; then
    echo "   ❌ FastAPI 未安装"
fi

"$PYTHON_PATH" -c "import uvicorn; print(f'  ✅ Uvicorn: {uvicorn.__version__}')" 2>&1
if [ $? -ne 0 ]; then
    echo "   ❌ Uvicorn 未安装"
fi

"$PYTHON_PATH" -c "import numpy; print(f'  ✅ NumPy: {numpy.__version__}')" 2>&1
if [ $? -ne 0 ]; then
    echo "   ❌ NumPy 未安装"
fi

"$PYTHON_PATH" -c "import PIL; print(f'  ✅ Pillow: {PIL.__version__}')" 2>&1
if [ $? -ne 0 ]; then
    echo "   ❌ Pillow 未安装"
fi

echo ""
echo "8. 检查后端文件..."
BACKEND_PATH="$RESOURCES_PATH/backend/main.py"
if [ ! -f "$BACKEND_PATH" ]; then
    echo "   ❌ 错误：后端文件不存在"
    exit 1
fi
echo "   ✅ 后端文件存在: $BACKEND_PATH"

echo ""
echo "9. 检查模型文件..."
MODEL_PATH="$RESOURCES_PATH/model_files/1.4/model.onnx"
if [ ! -f "$MODEL_PATH" ]; then
    echo "   ❌ 错误：模型文件不存在"
    exit 1
fi
echo "   ✅ 模型文件存在: $MODEL_PATH"
echo "   模型大小: $(du -h "$MODEL_PATH" | cut -f1)"

echo ""
echo "10. 尝试手动启动后端..."
echo "   将在 5 秒后尝试启动后端（按 Ctrl+C 取消）..."
sleep 5

echo "   启动后端..."
cd "$RESOURCES_PATH/backend"
"$PYTHON_PATH" main.py &
PID=$!
echo "   后端 PID: $PID"

echo "   等待 5 秒..."
sleep 5

echo ""
echo "11. 测试后端 API..."
curl -s http://127.0.0.1:8765/models/fixed > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ 后端 API 响应正常"
    echo "   模型列表:"
    curl -s http://127.0.0.1:8765/models/fixed | head -100
else
    echo "   ❌ 后端 API 无响应"
    echo "   正在收集日志..."
fi

echo ""
echo "12. 停止测试后端..."
kill $PID 2>/dev/null
echo "   已停止"

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "如果以上检查都通过但应用仍无法工作，请尝试："
echo "1. 完全删除应用后重新安装"
echo "2. 检查系统是否安装了 Rosetta 2: /usr/bin/pgrep oahd"
echo "3. 查看控制台日志: ~/Library/Logs/小飞AI抠图/"
echo "4. 联系开发者并提供此诊断输出"
