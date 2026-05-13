#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod curl_export;
mod curl_parser;
mod history;
mod http_client;

use history::HistoryStore;
use std::collections::HashMap;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(HistoryStore::new())
        .invoke_handler(tauri::generate_handler![
            parse_curl,
            to_curl,
            send_request,
            add_history_entry,
            get_history,
            clear_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
