#!/usr/bin/env python3
"""
模型下载管理器
首次启动时自动下载所需模型
"""

import os
import sys
import urllib.request
import zipfile
from pathlib import Path

# 模型配置
MODELS_CONFIG = {
    "1.4": {
        "name": "RMBG-1.4",
        "url": "https://github.com/pumf/ai-cutout/releases/download/models/rmbg-1.4.zip",
        "size_mb": 45,
        "files": ["1.4/model.onnx"]
    },
    "2.0": {
        "name": "RMBG-2.0", 
        "url": "https://github.com/pumf/ai-cutout/releases/download/models/rmbg-2.0.zip",
        "size_mb": 90,
        "files": ["2.0/model.onnx"]
    }
}

MODEL_DIR = Path(__file__).parent.parent / 'model_files'

def check_model_exists(model_id):
    """检查模型是否已下载"""
    config = MODELS_CONFIG.get(model_id)
    if not config:
        return False
    
    for file_path in config['files']:
        full_path = MODEL_DIR / file_path
        if not full_path.exists():
            return False
    return True

def download_model(model_id, progress_callback=None):
    """下载指定模型"""
    config = MODELS_CONFIG.get(model_id)
    if not config:
        raise ValueError(f"Unknown model: {model_id}")
    
    if check_model_exists(model_id):
        print(f"Model {model_id} already exists")
        return True
    
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    zip_path = MODEL_DIR / f"{model_id}.zip"
    
    print(f"Downloading {config['name']} ({config['size_mb']}MB)...")
    
    # 下载文件
    def report_progress(block_num, block_size, total_size):
        if progress_callback:
            downloaded = block_num * block_size
            percent = min(100, int(downloaded * 100 / total_size))
            progress_callback(percent)
    
    try:
        urllib.request.urlretrieve(
            config['url'], 
            zip_path,
            reporthook=report_progress
        )
    except Exception as e:
        print(f"Download failed: {e}")
        if zip_path.exists():
            zip_path.unlink()
        return False
    
    # 解压
    print("Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(MODEL_DIR)
    
    # 删除 zip 文件
    zip_path.unlink()
    
    print(f"Model {model_id} installed successfully")
    return True

def get_available_models():
    """获取可用的模型列表"""
    available = []
    for model_id, config in MODELS_CONFIG.items():
        available.append({
            'id': model_id,
            'name': config['name'],
            'size_mb': config['size_mb'],
            'installed': check_model_exists(model_id)
        })
    return available

if __name__ == '__main__':
    # 命令行测试
    models = get_available_models()
    print("Available models:")
    for m in models:
        status = "✓ Installed" if m['installed'] else "✗ Not installed"
        print(f"  {m['name']} ({m['size_mb']}MB) - {status}")
    
    # 默认下载 1.4 版本
    if not models[0]['installed']:
        print("\nDownloading default model (1.4)...")
        download_model('1.4', lambda p: print(f"Progress: {p}%", end='\r'))