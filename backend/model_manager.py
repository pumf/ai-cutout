#!/usr/bin/env python3
"""
模型下载管理器
首次启动时自动下载所需模型
"""

import os
import sys
import time
import threading
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

# 全局下载进度跟踪 — 由 FastAPI 路由查询,后台线程更新
# key=model_id, value={status, percent, downloaded, total, speed_bps, error, started_at}
_progress_lock = threading.Lock()
_progress: dict = {}
_active_threads: dict = {}


def _set_progress(model_id: str, **fields):
    with _progress_lock:
        cur = _progress.get(model_id, {})
        cur.update(fields)
        _progress[model_id] = cur


def get_download_progress(model_id: str = None):
    """获取下载进度。不传 model_id 返回全部"""
    with _progress_lock:
        if model_id is None:
            return dict(_progress)
        return _progress.get(model_id, {
            "status": "idle",
            "percent": 0,
            "downloaded": 0,
            "total": 0,
            "speed_bps": 0,
            "error": None,
        })

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
    """同步下载指定模型(主要给命令行使用)"""
    config = MODELS_CONFIG.get(model_id)
    if not config:
        raise ValueError(f"Unknown model: {model_id}")

    if check_model_exists(model_id):
        print(f"Model {model_id} already exists")
        return True

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    zip_path = MODEL_DIR / f"{model_id}.zip"

    print(f"Downloading {config['name']} ({config['size_mb']}MB)...")

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

    zip_path.unlink()

    print(f"Model {model_id} installed successfully")
    return True


def _download_worker(model_id: str):
    """后台线程下载,实时更新 _progress"""
    config = MODELS_CONFIG.get(model_id)
    if not config:
        _set_progress(model_id, status="error", error=f"未知模型: {model_id}")
        return

    if check_model_exists(model_id):
        _set_progress(model_id, status="done", percent=100)
        return

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = MODEL_DIR / f"{model_id}.zip"

    _set_progress(
        model_id,
        status="downloading",
        percent=0,
        downloaded=0,
        total=0,
        speed_bps=0,
        error=None,
        started_at=time.time(),
    )

    last_t = time.time()
    last_bytes = 0

    def hook(block_num, block_size, total_size):
        nonlocal last_t, last_bytes
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, int(downloaded * 100 / total_size))
        else:
            percent = 0
        now = time.time()
        dt = now - last_t
        speed = 0
        if dt >= 0.5:
            speed = int((downloaded - last_bytes) / dt) if dt > 0 else 0
            last_t = now
            last_bytes = downloaded
        _set_progress(
            model_id,
            percent=percent,
            downloaded=downloaded,
            total=total_size if total_size > 0 else 0,
            speed_bps=speed,
        )

    try:
        urllib.request.urlretrieve(config['url'], zip_path, reporthook=hook)
    except Exception as e:
        if zip_path.exists():
            try:
                zip_path.unlink()
            except Exception:
                pass
        _set_progress(model_id, status="error", error=str(e))
        return

    _set_progress(model_id, status="extracting", percent=100)
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(MODEL_DIR)
        zip_path.unlink()
    except Exception as e:
        _set_progress(model_id, status="error", error=f"解压失败: {e}")
        return

    _set_progress(model_id, status="done", percent=100)


def start_download_async(model_id: str) -> dict:
    """异步启动模型下载。立即返回当前状态,前端轮询 /models/download-progress 获取进度。"""
    config = MODELS_CONFIG.get(model_id)
    if not config:
        return {"success": False, "error": f"未知模型: {model_id}"}

    if check_model_exists(model_id):
        _set_progress(model_id, status="done", percent=100)
        return {"success": True, "already_exists": True}

    # 已有线程在跑
    with _progress_lock:
        cur = _progress.get(model_id, {})
        if cur.get("status") in ("downloading", "extracting"):
            return {"success": True, "already_running": True}

    t = threading.Thread(target=_download_worker, args=(model_id,), daemon=True)
    _active_threads[model_id] = t
    t.start()
    return {"success": True, "started": True}

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