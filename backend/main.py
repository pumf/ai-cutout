import os
import sys
import json
import logging
import base64
import io
from pathlib import Path
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

import torch
from torchvision import transforms
from PIL import Image
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / 'model_files'
OUTPUT_DIR = Path(__file__).parent / 'output'
OUTPUT_DIR.mkdir(exist_ok=True)

model = None
transform_image = None
device = None
current_model_info: Dict[str, Any] = {"name": None, "type": None, "path": None}


def scan_available_models() -> list:
    """Scan model_files directory for available models"""
    models = []
    
    if not MODEL_DIR.exists():
        return models
    
    for item in MODEL_DIR.iterdir():
        if item.is_file() and item.suffix in ['.safetensors', '.onnx']:
            models.append({
                "name": item.name,
                "path": str(item),
                "type": "safetensors" if item.suffix == '.safetensors' else "onnx",
                "size": item.stat().st_size
            })
        elif item.is_dir():
            for subfile in item.iterdir():
                if subfile.is_file() and subfile.suffix in ['.safetensors', '.onnx']:
                    models.append({
                        "name": f"{item.name}/{subfile.name}",
                        "path": str(subfile),
                        "type": "safetensors" if subfile.suffix == '.safetensors' else "onnx",
                        "size": subfile.stat().st_size
                    })
    
    return sorted(models, key=lambda x: x['name'])


def load_birefnet_model(model_path: Path):
    """Load BiRefNet model from safetensors file"""
    global model, transform_image, device
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    logger.info(f"Using device: {device}")
    
    model_files_dir = str(MODEL_DIR)
    sys.path.insert(0, model_files_dir)
    
    logger.info("Loading BiRefNet model...")
    from birefnet import BiRefNet
    
    class Config:
        task = 'DIS5K'
        training_set = 'DIS-TR'
        ms_supervision = True
        out_ref = True
        dec_ipt = True
        dec_ipt_split = True
        cxt_num = 3
        mul_scl_ipt = 'cat'
        dec_att = 'ASPPDeformable'
        squeeze_block = 'ASPPDeformable_x3'
        dec_blk = 'HierarAttDecBlk'
    
    config = Config()
    model = BiRefNet(config)
    
    logger.info(f"Loading weights from {model_path}")
    from safetensors.torch import load_file
    state_dict = load_file(str(model_path), device='cpu')
    model.load_state_dict(state_dict, strict=False)
    
    model.to(device)
    model.eval()
    
    transform_image = transforms.Compose([
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    logger.info("BiRefNet model loaded successfully")
    return model, transform_image, device


def load_onnx_model(model_path: Path):
    """Load ONNX model"""
    global model, device
    
    import onnxruntime as ort
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    logger.info(f"Using device: {device}")
    
    sess_options = ort.SessionOptions()
    sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    
    if device == 'cuda':
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    else:
        providers = ['CPUExecutionProvider']
    
    model = ort.InferenceSession(str(model_path), sess_options, providers=providers)
    
    logger.info(f"ONNX model loaded from {model_path}")
    return model


def load_model(model_path: str) -> Dict[str, Any]:
    """Load a model from the given path"""
    global model, transform_image, device, current_model_info
    
    path = Path(model_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Model file not found: {model_path}")
    
    model_type = path.suffix
    logger.info(f"Loading {model_type} model from {model_path}")
    
    if model_type == '.safetensors':
        model, transform_image, device = load_birefnet_model(path)
        model_name = "BiRefNet (RMBG)"
    elif model_type == '.onnx':
        model = load_onnx_model(path)
        transform_image = None
        model_name = "ONNX Model"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported model type: {model_type}")
    
    current_model_info = {
        "name": model_name,
        "type": model_type,
        "path": str(path),
        "loaded": True
    }
    
    return current_model_info


def unload_model():
    """Unload the current model to free memory"""
    global model, transform_image, device, current_model_info
    
    model = None
    transform_image = None
    current_model_info = {"name": None, "type": None, "path": None, "loaded": False}
    
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    
    logger.info("Model unloaded")


def process_birefnet(image: Image.Image, transform_fn, device) -> Image.Image:
    """Process image with BiRefNet model (RMBG 2.0)"""
    import numpy as np
    
    original_size = image.size
    
    # Preprocess with official normalization
    input_image = image.convert('RGB')
    pixel_values = transform_fn(input_image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        # Get last output and apply sigmoid
        preds = model(pixel_values)
        if isinstance(preds, (tuple, list)):
            preds = preds[-1]  # Get last output
        pred = preds[0].sigmoid().cpu()
    
    # Post-process: convert to PIL and resize
    pred_pil = transforms.ToPILImage()(pred)
    pred_pil = pred_pil.resize(original_size, Image.BILINEAR)
    
    # Create RGBA with alpha mask
    output = Image.new('RGBA', original_size, (0, 0, 0, 0))
    original_rgba = image.convert('RGBA')
    output.paste(original_rgba, (0, 0), mask=pred_pil)
    
    return output
    
    return output


def process_onnx(image: Image.Image) -> Image.Image:
    """Process image with ONNX model - BRIA RMBG 1.4"""
    import numpy as np
    
    original_size = image.size
    
    # Preprocess: resize to 1024x1024 and normalize
    input_image = image.convert('RGB').resize((1024, 1024))
    
    # Convert to array and normalize to [0, 1]
    img_array = np.array(input_image).astype(np.float32) / 255.0
    
    # Apply BRIA normalization: (x - 0.5) / 1.0
    img_array = (img_array - 0.5) / 1.0
    
    # Transpose to CHW format
    img_array = img_array.transpose(2, 0, 1)
    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)
    
    input_name = model.get_inputs()[0].name
    output_name = model.get_outputs()[0].name
    
    pred = model.run([output_name], {input_name: img_array})[0]
    
    logger.info(f"ONNX output shape: {pred.shape}, range: {pred.min():.3f} - {pred.max():.3f}")
    
    # Post-process: interpolate back to original size
    pred = pred.squeeze()  # Remove batch dimension
    
    # Handle various output shapes
    if pred.ndim == 3:
        pred = pred[0]  # Take first channel if still 3D
    
    # Normalize to [0, 1]
    ma = float(pred.max())
    mi = float(pred.min())
    pred = (pred - mi) / (ma - mi + 1e-8)
    
    # Convert to 8-bit grayscale
    pred = (pred * 255).astype('uint8')
    
    # Resize to original size
    pred_pil = Image.fromarray(pred, mode='L')
    pred_resized = pred_pil.resize(original_size, Image.BILINEAR)
    
    # Create new RGBA image from original with mask
    output = Image.new('RGBA', original_size, (0, 0, 0, 0))
    original_rgba = image.convert('RGBA')
    output.paste(original_rgba, (0, 0), mask=pred_resized)
    
    return output


def process_image(image: Image.Image) -> Image.Image:
    """Process image based on current model type"""
    global model, current_model_info
    
    if model is None:
        raise HTTPException(status_code=400, detail="No model loaded")
    
    if current_model_info.get("type") == '.safetensors':
        return process_birefnet(image, transform_image, device)
    elif current_model_info.get("type") == '.onnx':
        return process_onnx(image)
    else:
        raise HTTPException(status_code=400, detail="Unknown model type")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Background Remover API...")
    logger.info(f"Model directory: {MODEL_DIR}")
    logger.info(f"Available models: {scan_available_models()}")
    yield
    logger.info("Shutting down...")


app = FastAPI(title="AI Background Remover", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": current_model_info
    }


@app.get("/models")
async def list_models():
    """List all available models"""
    models = scan_available_models()
    for m in models:
        m['size_mb'] = round(m['size'] / 1024 / 1024, 2)
        del m['size']
    return {
        "available_models": models,
        "current_model": current_model_info
    }


@app.post("/models/load")
async def load_model_endpoint(request: Request):
    """Load a specific model by path"""
    body = await request.json()
    model_path = body.get('path')
    
    if not model_path:
        raise HTTPException(status_code=400, detail="Model path is required")
    
    try:
        info = load_model(model_path)
        return {"success": True, "model": info}
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/unload")
async def unload_model_endpoint():
    """Unload the current model"""
    unload_model()
    return {"success": True, "message": "Model unloaded"}


@app.post("/process")
async def process_upload(request: Request):
    global model
    
    if model is None:
        raise HTTPException(status_code=400, detail="No model loaded. Please load a model first.")
    
    try:
        body = await request.json()
        image_data = body.get('image', '')
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        result = process_image(image)
        
        output_path = OUTPUT_DIR / f"output_{os.urandom(8).hex()}.png"
        result.save(output_path, 'PNG')
        
        return FileResponse(
            output_path,
            media_type="image/png",
            headers={"X-Filename": output_path.name}
        )
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
