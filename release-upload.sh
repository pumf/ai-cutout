#!/bin/bash

# ============================================
# 小飞AI抠图 v1.0.2 Release 上传脚本
# ============================================

set -e

REPO="pumf/ai-cutout"
TAG="v1.0.2"
FILE_PATH="release-builds/小飞AI抠图_1.0.2_aarch64.dmg"
FILE_NAME="小飞AI抠图_1.0.2_aarch64.dmg"

echo "=========================================="
echo "小飞AI抠图 v1.0.2 Release 上传工具"
echo "=========================================="
echo ""

# 检查文件是否存在
if [ ! -f "$FILE_PATH" ]; then
    echo "❌ 错误: 找不到文件 $FILE_PATH"
    exit 1
fi

FILE_SIZE=$(du -h "$FILE_PATH" | cut -f1)
echo "✅ 找到文件: $FILE_NAME"
echo "   大小: $FILE_SIZE"
echo ""

# 获取 GitHub Token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "请输入 GitHub Personal Access Token:"
    echo "（获取方式: https://github.com/settings/tokens -> Generate new token -> 勾选 'repo' 权限）"
    read -s TOKEN
    echo ""
else
    TOKEN="$GITHUB_TOKEN"
    echo "✅ 使用环境变量中的 GITHUB_TOKEN"
fi

echo ""
echo "🚀 正在创建 Release $TAG..."

# 创建 Release
RELEASE_JSON=$(curl -s -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{
        \"tag_name\": \"$TAG\",
        \"name\": \"小飞AI抠图 v1.0.2\",
        \"body\": \"## 小飞AI抠图 v1.0.2\\n\\n### ✨ 新功能\\n- **完全自定义标题栏** - 支持拖拽移动窗口和双击最大化\\n- **窗口圆角设计** - 10px 圆角，更加美观\\n- **优化帮助说明页面** - 全新模块化设计，替换为 GitHub 开源链接\\n\\n### 🎨 功能优化\\n- **复制功能增强** - 现在复制的内容包含擦除/修补效果和背景合成\\n- **导出提示优化** - 取消导出时不再显示导出失败错误提示\\n- **编辑模式拖动** - 擦除和修补模式下原图区域支持拖动\\n- **光标同步缩放** - 缩放时虚拟圆形光标同步缩放\\n- **性能优化** - 修复拖动和缩放时的闪烁卡顿问题\\n\\n### 📦 平台支持\\n- ✅ macOS (Apple Silicon M1/M2/M3)\\n- ✅ macOS (Intel)\\n- ✅ Linux (x86_64)\\n- ✅ Windows (x86_64)\\n\\n### 🔧 安装说明\\n\\n**macOS Apple Silicon:** 下载 $FILE_NAME\\n\\n**macOS Intel:** 下载 小飞AI抠图_1.0.2_x64.dmg\\n\\n**Linux:** 下载 小飞AI抠图_1.0.2_amd64.AppImage\\n\`\`\`bash\\nchmod +x 小飞AI抠图_1.0.2_amd64.AppImage\\n./小飞AI抠图_1.0.2_amd64.AppImage\\n\`\`\`\\n\\n**Windows:** 下载 小飞AI抠图_1.0.2_x64.msi，双击安装\\n\\n### ⚠️ 首次运行注意事项\\n**macOS 用户：** 首次打开需要在 系统设置 > 隐私与安全性 中允许应用运行。\\n\\n### 🔗 开源地址\\nhttps://github.com/pumf/ai-cutout\",
        \"draft\": false,
        \"prerelease\": false
    }" \
    "https://api.github.com/repos/$REPO/releases" 2>&1)

# 检查是否成功
if echo "$RELEASE_JSON" | grep -q "Bad credentials"; then
    echo "❌ 错误: GitHub Token 无效"
    exit 1
fi

if echo "$RELEASE_JSON" | grep -q "already_exists"; then
    echo "⚠️  Release $TAG 已存在，尝试获取上传 URL..."
    
    # 获取已存在的 release
    EXISTING_RELEASE=$(curl -s \
        -H "Authorization: token $TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO/releases/tags/$TAG" 2>&1)
    
    UPLOAD_URL=$(echo "$EXISTING_RELEASE" | grep -o '"upload_url": "[^"]*' | cut -d'"' -f4 | sed 's/{?name,label}//')
else
    UPLOAD_URL=$(echo "$RELEASE_JSON" | grep -o '"upload_url": "[^"]*' | cut -d'"' -f4 | sed 's/{?name,label}//')
fi

if [ -z "$UPLOAD_URL" ]; then
    echo "❌ 错误: 无法创建或获取 Release"
    echo "响应: $RELEASE_JSON"
    exit 1
fi

echo "✅ Release 创建成功!"
echo ""
echo "🚀 正在上传文件（约需 1-2 分钟）..."
echo "   文件: $FILE_NAME"
echo "   大小: $FILE_SIZE"
echo ""

# 上传文件
curl -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --progress-bar \
    --data-binary "@$FILE_PATH" \
    "$UPLOAD_URL?name=$FILE_NAME" | cat

echo ""
echo ""
echo "=========================================="
echo "✅ 上传完成!"
echo "=========================================="
echo ""
echo "🎉 Release 地址:"
echo "   https://github.com/$REPO/releases/tag/$TAG"
echo ""
echo "📦 已上传:"
echo "   - $FILE_NAME ($FILE_SIZE)"
echo ""
echo "🔄 其他平台版本将通过 GitHub Actions 自动构建并上传"
echo "   查看进度: https://github.com/$REPO/actions"
echo ""
echo "=========================================="
