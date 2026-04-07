#!/usr/bin/env python3
"""
Upload release assets to GitHub without gh CLI
Requires: pip install requests
"""

import os
import sys
import requests

def upload_release_asset(token, owner, repo, tag, file_path):
    """Upload a file to GitHub Release"""
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # Get release info
    release_url = f"https://api.github.com/repos/{owner}/{repo}/releases/tags/{tag}"
    resp = requests.get(release_url, headers=headers, timeout=30)
    
    if resp.status_code != 200:
        print(f"Error: Cannot find release {tag}")
        print(resp.text)
        return False
    
    release_id = resp.json()["id"]
    upload_url = resp.json()["upload_url"].replace("{?name,label}", "")
    
    file_name = os.path.basename(file_path)
    print(f"\nUploading: {file_name}")
    print(f"File size: {os.path.getsize(file_path) / 1024 / 1024:.1f} MB")
    
    # Check if file already exists
    assets_url = f"https://api.github.com/repos/{owner}/{repo}/releases/{release_id}/assets"
    assets_resp = requests.get(assets_url, headers=headers, timeout=30)
    
    if assets_resp.status_code == 200:
        for asset in assets_resp.json():
            if asset["name"] == file_name:
                print(f"  Deleting existing asset...")
                delete_resp = requests.delete(asset["url"], headers=headers, timeout=30)
                if delete_resp.status_code == 204:
                    print(f"  ✓ Deleted old version")
                break
    
    # Upload new file
    headers["Content-Type"] = "application/octet-stream"
    
    with open(file_path, "rb") as f:
        upload_resp = requests.post(
            f"{upload_url}?name={requests.utils.quote(file_name)}",
            headers=headers,
            data=f,
            timeout=600
        )
    
    if upload_resp.status_code == 201:
        print(f"  ✓ Success!")
        print(f"  URL: {upload_resp.json()['browser_download_url']}")
        return True
    else:
        print(f"  ✗ Failed: {upload_resp.status_code}")
        print(f"  {upload_resp.text[:200]}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 upload.py YOUR_GITHUB_TOKEN")
        print("\nGet token from: https://github.com/settings/tokens")
        print("Required scope: 'repo'")
        sys.exit(1)
    
    token = sys.argv[1]
    owner = "pumf"
    repo = "ai-cutout"
    tag = "v1.0.1"
    
    release_dir = "/Users/mac/Project/open_code/ai-cutout/release"
    
    files = [
        ("小飞AI抠图-1.0.0.dmg", "Intel Mac"),
        ("小飞AI抠图-1.0.0-arm64.dmg", "Apple Silicon Mac"),
        ("小飞AI抠图 Setup 1.0.0.exe", "Windows"),
        ("小飞AI抠图-1.0.0.AppImage", "Linux")
    ]
    
    print(f"Uploading to GitHub Release {tag}\n")
    
    success = 0
    for filename, platform in files:
        filepath = os.path.join(release_dir, filename)
        if os.path.exists(filepath):
            print(f"\n[{platform}]")
            if upload_release_asset(token, owner, repo, tag, filepath):
                success += 1
        else:
            print(f"\n✗ Not found: {filename}")
    
    print(f"\n{'='*50}")
    print(f"Completed: {success}/{len(files)} files uploaded")
    print(f"{'='*50}")
    
    if success == len(files):
        print("\n✓ All files uploaded successfully!")
        print(f"\nView release: https://github.com/{owner}/{repo}/releases/tag/{tag}")

if __name__ == "__main__":
    main()