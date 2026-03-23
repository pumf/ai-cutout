import os
import sys
import json
import logging
import base64
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

import torch
from torchvision import transforms
from PIL import Image
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import io
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


def get_model():
    global model, transform_image, device
    
    if model is not None:
        return model, transform_image, device
    
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
    
    model_path = MODEL_DIR / 'model.safetensors'
    if model_path.exists():
        logger.info(f"Loading weights from {model_path}")
        from safetensors.torch import load_file
        state_dict = load_file(str(model_path), device='cpu')
        model.load_state_dict(state_dict, strict=False)
    
    model.to(device)
    model.eval()
    
    image_size = (1024, 1024)
    transform_image = transforms.Compose([
        transforms.Resize(image_size),
        transforms.ToTensor(),
    ])
    
    logger.info("Model loaded successfully")
    return model, transform_image, device


def process_image(image: Image.Image, model, transform_fn, device) -> Image.Image:
    original_size = image.size
    
    input_image = image.convert('RGB')
    input_image = input_image.resize((1024, 1024))
    
    pixel_values = transform_fn(input_image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        preds = model(pixel_values)[-1].sigmoid().cpu()
    
    mask = preds.squeeze().numpy()
    mask = (mask * 255).astype('uint8')
    mask = Image.fromarray(mask).resize(original_size, Image.LANCZOS)
    
    output = image.convert('RGBA')
    output.putalpha(mask)
    
    return output


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Background Remover API...")
    try:
        get_model()
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        import traceback
        traceback.print_exc()
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
    global model
    return {
        "status": "ok" if model is not None else "model_loading",
        "device": device,
        "model_loaded": model is not None
    }


@app.get("/model/status")
async def model_status():
    global model
    model_path = MODEL_DIR / 'model.safetensors'
    
    return {
        "loaded": model is not None,
        "path": str(MODEL_DIR),
        "exists": model_path.exists()
    }


@app.post("/process")
async def process_upload(request: Request):
    global model, transform_image, device
    
    if model is None:
        try:
            get_model()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")
    
    try:
        body = await request.json()
        image_data = body.get('image', '')
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        result = process_image(image, model, transform_image, device)
        
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
