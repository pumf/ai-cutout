// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

use ort::session::Session;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};
use tokio::sync::Mutex;

#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, NO, YES};
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

mod model;

pub struct AppState {
    pub model: Mutex<Option<Session>>,
    pub model_info: Mutex<ModelInfo>,
}

#[derive(Default, Serialize, Clone)]
pub struct ModelInfo {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub path: Option<String>,
    pub loaded: bool,
}

#[derive(Serialize)]
struct FixedModel {
    id: String,
    name: String,
    display_name: String,
    path: Option<String>,
    #[serde(rename = "type")]
    model_type: String,
    exists: bool,
    size_mb: u64,
    download_url: Option<String>,
}

#[derive(Deserialize)]
struct ProcessImageRequest {
    image: String, // base64 encoded
}

#[derive(Serialize)]
struct ProcessImageResponse {
    success: bool,
    image: Option<String>, // base64 encoded
    error: Option<String>,
}

#[tauri::command]
async fn list_fixed_models(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let app_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let model_dir = app_dir.join("model_files");

    let models = vec![
        FixedModel {
            id: "1.4".to_string(),
            name: "RMBG-1.4".to_string(),
            display_name: "RMBG-1.4 (速度快)".to_string(),
            path: check_model_path(&model_dir, "1.4/model.onnx"),
            model_type: "onnx".to_string(),
            exists: model_dir.join("1.4/model.onnx").exists(),
            size_mb: get_file_size_mb(&model_dir.join("1.4/model.onnx")),
            download_url: None,
        },
        FixedModel {
            id: "2.0".to_string(),
            name: "RMBG-2.0".to_string(),
            display_name: "RMBG-2.0 (精度高)".to_string(),
            path: check_model_path(&model_dir, "2.0/model.onnx"),
            model_type: "onnx".to_string(),
            exists: model_dir.join("2.0/model.onnx").exists(),
            size_mb: get_file_size_mb(&model_dir.join("2.0/model.onnx")),
            download_url: Some("https://modelscope.cn/models/AI-ModelScope/RMBG-2.0/resolve/master/onnx/model.onnx".to_string()),
        },
    ];

    let current_model = state.model_info.lock().await.clone();
    let current_model_id = if current_model.loaded {
        current_model.name.as_ref().and_then(|name| {
            if name.contains("2.0") {
                Some("2.0".to_string())
            } else {
                Some("1.4".to_string())
            }
        })
    } else {
        None
    };

    Ok(serde_json::json!({
        "models": models,
        "current_model_id": current_model_id,
        "current_model": current_model
    }))
}

fn check_model_path(model_dir: &PathBuf, relative_path: &str) -> Option<String> {
    let full_path = model_dir.join(relative_path);
    if full_path.exists() {
        Some(full_path.to_string_lossy().to_string())
    } else {
        None
    }
}

fn get_file_size_mb(path: &PathBuf) -> u64 {
    if let Ok(metadata) = std::fs::metadata(path) {
        (metadata.len() as f64 / (1024.0 * 1024.0)).round() as u64
    } else {
        0
    }
}

#[tauri::command]
async fn load_fixed_model(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<serde_json::Value, String> {
    let app_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let (model_path, model_name, model_display_name) = match model_id.as_str() {
        "1.4" => (
            app_dir.join("model_files/1.4/model.onnx"),
            "RMBG-1.4",
            "RMBG-1.4 (速度快)"
        ),
        "2.0" => (
            app_dir.join("model_files/2.0/model.onnx"),
            "RMBG-2.0",
            "RMBG-2.0 (精度高)"
        ),
        _ => return Err(format!("Unknown model: {}", model_id)),
    };

    if !model_path.exists() {
        return Err(format!("Model file not found: {:?}", model_path));
    }

    // Load the ONNX model
    let session = model::load_model(&model_path)
        .map_err(|e| format!("Failed to load model: {}", e))?;

    // Update state
    {
        let mut model = state.model.lock().await;
        *model = Some(session);
    }

    {
        let mut model_info = state.model_info.lock().await;
        *model_info = ModelInfo {
            name: Some(model_name.to_string()),
            display_name: Some(model_display_name.to_string()),
            path: Some(model_path.to_string_lossy().to_string()),
            loaded: true,
        };
    }

    Ok(serde_json::json!({
        "success": true,
        "model": state.model_info.lock().await.clone()
    }))
}

#[tauri::command]
async fn load_custom_model(
    state: State<'_, AppState>,
    model_path: String,
    model_id: String,
) -> Result<serde_json::Value, String> {
    let path = std::path::PathBuf::from(&model_path);
    
    if !path.exists() {
        return Err(format!("Model file not found: {}", model_path));
    }

    // Load the ONNX model
    let session = model::load_model(&path)
        .map_err(|e| format!("Failed to load model: {}", e))?;

    let (model_name, model_display_name) = match model_id.as_str() {
        "1.4" => ("RMBG-1.4", "RMBG-1.4 (速度快)"),
        "2.0" => ("RMBG-2.0", "RMBG-2.0 (精度高)"),
        _ => ("Custom Model", "自定义模型"),
    };

    // Update state
    {
        let mut model = state.model.lock().await;
        *model = Some(session);
    }

    {
        let mut model_info = state.model_info.lock().await;
        *model_info = ModelInfo {
            name: Some(model_name.to_string()),
            display_name: Some(model_display_name.to_string()),
            path: Some(model_path),
            loaded: true,
        };
    }

    Ok(serde_json::json!({
        "success": true,
        "model": state.model_info.lock().await.clone()
    }))
}

#[tauri::command]
async fn process_image(
    state: State<'_, AppState>,
    request: ProcessImageRequest,
) -> Result<ProcessImageResponse, String> {
    
    // Check if model is loaded
    {
        let model = state.model.lock().await;
        if model.is_none() {
            return Ok(ProcessImageResponse {
                success: false,
                image: None,
                error: Some("No model loaded".to_string()),
            });
        }
    }

    // Decode base64 image
    use base64::{Engine as _, engine::general_purpose};
    let clean_base64 = request.image
        .replace("data:image/png;base64,", "")
        .replace("data:image/jpeg;base64,", "")
        .replace("data:image/jpg;base64,", "")
        .replace("data:image/webp;base64,", "");
    
    let image_data = match general_purpose::STANDARD.decode(&clean_base64) {
        Ok(data) => data,
        Err(e) => {
            return Ok(ProcessImageResponse {
                success: false,
                image: None,
                error: Some(format!("Failed to decode image: {}", e)),
            });
        }
    };

    // Process image - acquire lock for processing
    let result = {
        let mut model = state.model.lock().await;
        let session = model.as_mut().unwrap();
        model::process_image_with_model(session, &image_data).await
    };

    match result {
        Ok(processed_image) => {
            let base64_image = general_purpose::STANDARD.encode(&processed_image);
            Ok(ProcessImageResponse {
                success: true,
                image: Some(format!("data:image/png;base64,{}", base64_image)),
                error: None,
            })
        }
        Err(e) => {
            Ok(ProcessImageResponse {
                success: false,
                image: None,
                error: Some(format!("Processing failed: {}", e)),
            })
        }
    }
}

#[tauri::command]
async fn health_check(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let model_info = state.model_info.lock().await.clone();
    
    Ok(serde_json::json!({
        "status": "ok",
        "model": model_info
    }))
}

#[tauri::command]
async fn copy_image_to_clipboard(
    image_data: String,
    clipboard: tauri::State<'_, tauri_plugin_clipboard_manager::Clipboard<tauri::Wry>>,
) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose};
    
    println!("[Rust] copy_image_to_clipboard called");
    println!("[Rust] image_data length: {}", image_data.len());
    
    // Decode base64 image data
    let base64_data = image_data.replace("data:image/png;base64,", "")
        .replace("data:image/jpeg;base64,", "")
        .replace("data:image/jpg;base64,", "")
        .replace("data:image/webp;base64,", "");
    
    println!("[Rust] base64_data length: {}", base64_data.len());
    
    let bytes = general_purpose::STANDARD.decode(&base64_data)
        .map_err(|e| {
            println!("[Rust] Failed to decode base64: {}", e);
            format!("Failed to decode image: {}", e)
        })?;
    
    println!("[Rust] Decoded bytes length: {}", bytes.len());
    
    // Load image to get dimensions
    let img = image::load_from_memory(&bytes)
        .map_err(|e| {
            println!("[Rust] Failed to load image: {}", e);
            format!("Failed to load image: {}", e)
        })?;
    
    let width = img.width();
    let height = img.height();
    println!("[Rust] Image dimensions: {}x{}", width, height);
    
    let rgba = img.to_rgba8();
    let rgba_bytes = rgba.into_raw();
    println!("[Rust] RGBA bytes length: {}", rgba_bytes.len());
    
    // Create tauri Image
    let tauri_image = tauri::image::Image::new_owned(rgba_bytes, width, height);
    println!("[Rust] Created tauri image");
    
    // Use tauri-plugin-clipboard-manager to write image
    match clipboard.write_image(&tauri_image) {
        Ok(_) => {
            println!("[Rust] Successfully wrote to clipboard");
            Ok(())
        }
        Err(e) => {
            println!("[Rust] Failed to write to clipboard: {}", e);
            Err(format!("Failed to write to clipboard: {}", e))
        }
    }
}

fn main() {
    let app_state = AppState {
        model: Mutex::new(None),
        model_info: Mutex::new(ModelInfo::default()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            list_fixed_models,
            load_fixed_model,
            load_custom_model,
            process_image,
            health_check,
            copy_image_to_clipboard
        ])
        .setup(|app| {
            // Configure window for rounded corners on macOS
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").unwrap();
                let ns_window = window.ns_window().unwrap() as id;
                
                unsafe {
                    // Make window non-opaque with clear background
                    let _: () = msg_send![ns_window, setOpaque: NO];
                    let _: () = msg_send![ns_window, setBackgroundColor: cocoa::appkit::NSColor::clearColor(nil)];
                    let _: () = msg_send![ns_window, setHasShadow: true];
                    
                    // Set corner radius on the content view's layer
                    let content_view: id = msg_send![ns_window, contentView];
                    if content_view != nil {
                        let _: () = msg_send![content_view, setWantsLayer: YES];
                        let layer: id = msg_send![content_view, layer];
                        if layer != nil {
                            let _: () = msg_send![layer, setCornerRadius: 10.0_f64];
                        }
                    }
                }
            }
            
            // Try to auto-load model on startup
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait for app to fully initialize
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                
                // Auto-load the built-in model
                let state = handle.state::<AppState>();
                if let Ok(app_dir) = handle.path().resource_dir() {
                    // Try to auto-load RMBG-1.4 first
                    let model_path = app_dir.join("model_files/1.4/model.onnx");
                    
                    if model_path.exists() {
                        match model::load_model(&model_path) {
                            Ok(session) => {
                                let mut model = state.model.lock().await;
                                *model = Some(session);
                                
                                let mut model_info = state.model_info.lock().await;
                                *model_info = ModelInfo {
                                    name: Some("RMBG-1.4".to_string()),
                                    display_name: Some("RMBG-1.4 (速度快)".to_string()),
                                    path: Some(model_path.to_string_lossy().to_string()),
                                    loaded: true,
                                };
                                
                                // Emit event to notify frontend that model is loaded
                                let _ = handle.emit("model-auto-loaded", ());
                            }
                            Err(e) => {
                                eprintln!("Failed to auto-load model: {}", e);
                            }
                        }
                    } else {
                        eprintln!("Model file not found at: {:?}", model_path);
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
