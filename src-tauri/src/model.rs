use std::path::Path;

use image::{imageops::FilterType, ImageBuffer, ImageEncoder};
use ndarray::Array;
use ort::session::{Session, builder::GraphOptimizationLevel};
use ort::value::Value;

fn to_string_error<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// Type alias for the model type
pub type Model = Session;

pub fn load_model<P: AsRef<Path>>(model_path: P) -> Result<Model, String> {
    let path = model_path.as_ref();
    eprintln!("[Model] Attempting to load model from: {:?}", path);
    
    // Check if file exists
    if !path.exists() {
        let err_msg = format!("Model file not found: {:?}", path);
        eprintln!("[Model] Error: {}", err_msg);
        return Err(err_msg);
    }
    
    // Check file size
    if let Ok(metadata) = std::fs::metadata(path) {
        let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
        eprintln!("[Model] Model file size: {:.2} MB", size_mb);
    }
    
    // Load ONNX model using ort
    eprintln!("[Model] Loading ONNX model with ort...");
    
    // Read model file into memory
    let model_bytes = std::fs::read(path)
        .map_err(|e| format!("Failed to read model file: {}", e))?;
    
    let session = Session::builder()
        .map_err(to_string_error)?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(to_string_error)?
        .with_intra_threads(4)
        .map_err(to_string_error)?
        .commit_from_memory(&model_bytes)
        .map_err(|e| {
            eprintln!("[Model] Failed to load model: {}", e);
            format!("Failed to load ONNX model: {}", e)
        })?;
    
    eprintln!("[Model] Model loaded successfully!");
    Ok(session)
}

pub async fn process_image_with_model(
    session: &mut Session,
    image_data: &[u8],
) -> Result<Vec<u8>, String> {
    // Load image
    let img = image::load_from_memory(image_data).map_err(to_string_error)?;
    let original_size = (img.width(), img.height());

    // Resize to 1024x1024 (model input size)
    let resized = img.resize_exact(1024, 1024, FilterType::Lanczos3);

    // Convert to RGB and normalize
    let rgb_img = resized.to_rgb8();
    let (width, height) = (rgb_img.width(), rgb_img.height());

    // Create input tensor [1, 3, 1024, 1024]
    let mut input_data: Vec<f32> = Vec::with_capacity(3 * 1024 * 1024);

    // BRIA normalization: (x - 0.5) / 1.0
    for c in 0..3 {
        for y in 0..height {
            for x in 0..width {
                let pixel = rgb_img.get_pixel(x, y);
                let value = pixel[c] as f32 / 255.0;
                let normalized = (value - 0.5) / 1.0;
                input_data.push(normalized);
            }
        }
    }

    let input_array = Array::from_shape_vec((1, 3, 1024, 1024), input_data)
        .map_err(|e| e.to_string())?;
    let input_value = Value::from_array(input_array)
        .map_err(to_string_error)?;

    // Run inference
    let outputs = session.run(ort::inputs![input_value])
        .map_err(to_string_error)?;
    let output_tensor = outputs[0].try_extract_tensor::<f32>()
        .map_err(to_string_error)?;
    
    // Extract the data from the tensor
    let mask_data: Vec<f32> = output_tensor.1.iter().copied().collect();

    // Normalize mask to 0-255
    let min_val = mask_data.iter().cloned().fold(f32::INFINITY, f32::min);
    let max_val = mask_data.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let range = max_val - min_val;

    let normalized_mask: Vec<u8> = mask_data
        .iter()
        .map(|&v| {
            let normalized = (v - min_val) / (range + 1e-8);
            (normalized * 255.0) as u8
        })
        .collect();

    // Create mask image
    let mask_img: ImageBuffer<image::Luma<u8>, Vec<u8>> = ImageBuffer::from_raw(1024, 1024, normalized_mask)
        .ok_or_else(|| "Failed to create mask image".to_string())?;

    // Resize mask back to original size
    let resized_mask = image::imageops::resize(&mask_img, original_size.0, original_size.1, FilterType::Triangle);

    // Load original image with alpha
    let mut original_rgba = img.to_rgba8();

    // Apply mask to original image
    for (x, y, pixel) in original_rgba.enumerate_pixels_mut() {
        let mask_value = resized_mask.get_pixel(x, y)[0];
        pixel[3] = mask_value;
    }

    // Encode to PNG
    let mut output_buffer = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut output_buffer);
    encoder.write_image(
        &original_rgba,
        original_rgba.width(),
        original_rgba.height(),
        image::ColorType::Rgba8.into(),
    ).map_err(to_string_error)?;

    Ok(output_buffer)
}
