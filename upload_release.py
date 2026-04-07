#!/usr/bin/env python3
"""
上传安装包到 GitHub Release v1.0.1
使用方法: python3 upload_release.py YOUR_GITHUB_TOKEN
"""

import sys
import os
import requests

def upload_to_github(token, release_tag, file_path):
    """Upload a file to GitHub Release"""
    
    # GitHub repo info
    owner = "pumf"
    repo = "ai-cutout"
    
    # Get release info
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # Get release by tag
    release_url = f"https://api.github.com/repos/{owner}/{repo}/releases/tags/{release_tag}"
    response = requests.get(release_url, headers=headers)
    
    if response.status_code != 200:
        print(f"Error getting release: {response.status_code}")
        print(response.text)
        return False
    
    release_id = response.json()["id"]
    upload_url = response.json()["upload_url"].replace("{?name,label}", "")
    
    # Upload file
    file_name = os.path.basename(file_path)
    print(f"Uploading {file_name}...")
    
    with open(file_path, "rb") as f:
        headers["Content-Type"] = "application/octet-stream"
        upload_response = requests.post(
            f"{upload_url}?name={file_name}",
            headers=headers,
            data=f
        )
    
    if upload_response.status_code == 201:
        print(f"✓ Successfully uploaded {file_name}")
        print(f"  URL: {upload_response.json()['browser_download_url']}")
        return True
    else:
        print(f"✗ Failed to upload {file_name}: {upload_response.status_code}")
        print(upload_response.text)
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 upload_release.py YOUR_GITHUB_TOKEN")
        print("\nTo create a GitHub token:")
        print("1. Go to https://github.com/settings/tokens")
        print("2. Click 'Generate new token (classic)'")
        print("3. Select 'repo' scope")
        print("4. Generate and copy the token")
        sys.exit(1)
    
    token = sys.argv[1]
    release_tag = "v1.0.1"
    release_dir = "/Users/mac/Project/open_code/ai-cutout/release"
    
    # Files to upload
    files = [
        "小飞AI抠图-1.0.0.dmg",           # Intel Mac
        "小飞AI抠图-1.0.0-arm64.dmg",     # Apple Silicon Mac
        "小飞AI抠图 Setup 1.0.0.exe",     # Windows
        "小飞AI抠图-1.0.0.AppImage"       # Linux
    ]
    
    print(f"Uploading to GitHub Release {release_tag}\n")
    
    success_count = 0
    for filename in files:
        file_path = os.path.join(release_dir, filename)
        if os.path.exists(file_path):
            if upload_to_github(token, release_tag, file_path):
                success_count += 1
            print()
        else:
            print(f"✗ File not found: {file_path}\n")
    
    print(f"\n{'='*50}")
    print(f"Upload complete: {success_count}/{len(files)} files uploaded")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()