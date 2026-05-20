#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod collections;
mod environments;
mod storage;
mod curl_export;
mod curl_parser;
mod history;
mod http_client;
mod proxy_config;

use history::HistoryStore;
use std::collections::HashMap;
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

#[tauri::command]
fn get_default_data_dir() -> Result<String, String> {
    storage::default_data_dir()
}

#[tauri::command]
fn ensure_data_dir(data_dir: String) -> Result<(), String> {
    storage::ensure_data_dir(&data_dir)
}

#[tauri::command]
fn environments_load(data_dir: String) -> Result<Option<String>, String> {
    environments::load(&data_dir)
}

#[tauri::command]
fn environments_save(data_dir: String, data: String) -> Result<(), String> {
    environments::save(&data_dir, &data)
}

#[tauri::command]
fn load_collections(dir: String) -> Result<String, String> {
    collections::load_tree(&dir)
}

#[tauri::command]
fn collections_save(dir: String, file_name: String, data: String) -> Result<(), String> {
    collections::save_collection(&dir, &file_name, &data)
}

#[tauri::command]
fn collections_create(dir: String, id: String, name: String) -> Result<String, String> {
    collections::create_collection(&dir, &id, &name)
}

#[tauri::command]
fn collections_delete(dir: String, file_name: String) -> Result<(), String> {
    collections::delete_collection(&dir, &file_name)
}

#[tauri::command]
fn collections_rename(
    dir: String,
    file_name: String,
    new_name: String,
) -> Result<String, String> {
    collections::rename_collection(&dir, &file_name, &new_name)
}

#[tauri::command]
fn force_close_window(window: tauri::Window) {
    let _ = window.close();
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
            get_default_data_dir,
            ensure_data_dir,
            environments_load,
            environments_save,
            load_collections,
            collections_save,
            collections_create,
            collections_delete,
            collections_rename,
            force_close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
