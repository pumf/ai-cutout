#!/bin/bash

# GitHub Release Upload Script for ai-cutout v1.0.2
# Usage: ./upload-release.sh YOUR_GITHUB_TOKEN

TOKEN=$1

if [ -z "$TOKEN" ]; then
    echo "Usage: ./upload-release.sh YOUR_GITHUB_TOKEN"
    echo "Get token from: https://github.com/settings/tokens"
    echo "Required scopes: repo"
    exit 1
fi

REPO="pumf/ai-cutout"
TAG="v1.0.2"
FILE="release-builds/小飞AI抠图_1.0.2_aarch64.dmg"

echo "Creating release $TAG..."

# Create release
RELEASE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -d '{
        "tag_name": "'"$TAG"'",
        "name": "小飞AI抠图 v1.0.2",
        "body": "## 小飞AI抠图 v1.0.2\n\n### ✨ 新功能\n- 完全自定义标题栏\n- 窗口圆角设计\n- 优化帮助说明页面\n\n### 🎨 功能优化\n- 复制功能增强\n- 导出提示优化\n- 编辑模式拖动\n- 光标同步缩放\n- 性能优化\n\n### 📦 平台支持\n- ✅ macOS (Apple Silicon)\n- ✅ macOS (Intel)\n- ✅ Linux\n- ✅ Windows\n\n### 🔗 开源地址\nhttps://github.com/pumf/ai-cutout",
        "draft": false,
        "prerelease": false
    }' \
    "https://api.github.com/repos/$REPO/releases")

# Extract upload URL
UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | grep -o '"upload_url": "[^"]*' | cut -d'"' -f4 | sed 's/{?name,label}//')

if [ -z "$UPLOAD_URL" ]; then
    echo "Failed to create release or release already exists"
    echo "Response: $RELEASE_RESPONSE"
    exit 1
fi

echo "Release created!"
echo "Upload URL: $UPLOAD_URL"

# Upload file
echo "Uploading $FILE..."

FILENAME=$(basename "$FILE")
curl -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$FILE" \
    "$UPLOAD_URL?name=$FILENAME"

echo ""
echo "Upload complete!"
echo "Release URL: https://github.com/$REPO/releases/tag/$TAG"
