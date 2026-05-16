#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod curl_export;
mod curl_parser;
mod history;
mod http_client;

use history::HistoryStore;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

#[tauri::command]
fn parse_curl(command: &str) -> Result<curl_parser::ParsedCurl, String> {
    curl_parser::parse_curl(command)
}

#[tauri::command]
fn to_curl(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body_type: String,
    body: Option<String>,
) -> String {
    curl_export::to_curl(curl_export::ExportRequest {
        method,
        url,
        headers,
        body_type,
        body,
    })
}

#[tauri::command]
async fn send_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body_type: String,
    body: Option<String>,
) -> Result<http_client::SendResponse, String> {
    http_client::send(http_client::SendRequest {
        method,
        url,
        headers,
        body_type,
        body,
    })
    .await
}

#[tauri::command]
fn add_history_entry(
    method: String,
    url: String,
    status: u16,
    time: String,
    state: tauri::State<HistoryStore>,
) {
    state.add(history::HistoryEntry {
        id: String::new(),
        time,
        method,
        url,
        status,
    });
}

#[tauri::command]
fn get_history(state: tauri::State<HistoryStore>) -> Vec<history::HistoryEntry> {
    state.get()
}

#[tauri::command]
fn clear_history(state: tauri::State<HistoryStore>) {
    state.clear();
}

const COLLECTION_FILE: &str = "apilite-collections.json";
const DEFAULT_COLLECTION_DIR: &str = ".APILite/collections";

#[tauri::command]
fn get_default_collection_dir() -> Result<String, String> {
    let home = dirs_next::home_dir().ok_or("Cannot determine home directory")?;
    Ok(home.join(DEFAULT_COLLECTION_DIR).to_string_lossy().to_string())
}

#[tauri::command]
fn load_collections(dir: String) -> Result<String, String> {
    let path = PathBuf::from(&dir).join(COLLECTION_FILE);
    if !path.exists() {
        return Ok("[]".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read collections: {}", e))
}

#[tauri::command]
fn force_close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn save_collections(dir: String, data: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&dir);
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    let path = dir_path.join(COLLECTION_FILE);
    fs::write(&path, data).map_err(|e| format!("Failed to write collections: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(HistoryStore::new())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("native-close-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            parse_curl,
            to_curl,
            send_request,
            add_history_entry,
            get_history,
            clear_history,
            get_default_collection_dir,
            load_collections,
            save_collections,
            force_close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
