use std::path::Path;

use image::{imageops::FilterType, ImageBuffer, ImageEncoder};
use ndarray::Array;
use tract_onnx::prelude::*;

fn to_string_error<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

pub fn load_model<P: AsRef<Path>>(model_path: P) -> Result<SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>, String> {
    // Load ONNX model using tract
    let model = tract_onnx::onnx()
        .model_for_path(model_path)
        .map_err(to_string_error)?
        .into_optimized()
        .map_err(to_string_error)?
        .into_runnable()
        .map_err(to_string_error)?;

    Ok(model)
}

pub async fn process_image_with_model(
    model: &mut SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>,
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
    
    // Convert to tract tensor
    let input_tensor: Tensor = input_array.into();
    
    // Run inference
    let outputs = model.run(tvec!(input_tensor.into()))
        .map_err(to_string_error)?;
    
    // Extract output tensor
    let output_tensor = outputs[0].to_array_view::<f32>()
        .map_err(to_string_error)?;
    
    // Extract the data from the tensor
    let mask_data: Vec<f32> = output_tensor.iter().copied().collect();

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
