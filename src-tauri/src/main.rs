#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod folders;
mod environments;
mod histories;
mod storage;
mod curl_export;
mod curl_parser;
mod http_client;
mod proxy_config;
mod script_daemon;
mod script_runner;
mod scripts;
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
    form_fields: Vec<curl_export::FormFieldPart>,
    binary_file_path: Option<String>,
    binary_file_name: Option<String>,
    binary_data_base64: Option<String>,
) -> String {
    curl_export::to_curl(curl_export::ExportRequest {
        method,
        url,
        headers,
        body_type,
        body,
        form_fields,
        binary_file_path,
        binary_file_name,
        binary_data_base64,
    })
}

#[tauri::command]
async fn send_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body_type: String,
    body: Option<String>,
    form_fields: Vec<http_client::FormFieldPart>,
    binary_file_path: Option<String>,
    binary_file_name: Option<String>,
    binary_data_base64: Option<String>,
) -> Result<http_client::SendResponse, String> {
    http_client::send(http_client::SendRequest {
        method,
        url,
        headers,
        body_type,
        body,
        form_fields,
        binary_file_path,
        binary_file_name,
        binary_data_base64,
    })
    .await
}

#[tauri::command]
fn histories_load(data_dir: String, max_age_days: u32) -> Result<Option<String>, String> {
    histories::load(&data_dir, max_age_days)
}

#[tauri::command]
fn histories_load_page(
    data_dir: String,
    max_age_days: u32,
    offset: usize,
    limit: usize,
) -> Result<histories::HistoryPageResult, String> {
    histories::load_page(&data_dir, max_age_days, offset, limit)
}

#[tauri::command]
fn histories_sync(
    data_dir: String,
    updates: HashMap<String, String>,
    keep_days: Vec<String>,
    max_age_days: u32,
) -> Result<(), String> {
    histories::sync(&data_dir, updates, keep_days, max_age_days)
}

#[tauri::command]
fn histories_clear(data_dir: String) -> Result<(), String> {
    histories::clear(&data_dir)
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
fn load_folders(dir: String) -> Result<String, String> {
    folders::load_tree(&dir)
}

#[tauri::command]
fn folders_save(dir: String, file_name: String, data: String) -> Result<(), String> {
    folders::save_folder(&dir, &file_name, &data)
}

#[tauri::command]
fn folders_create(dir: String, id: String, name: String) -> Result<String, String> {
    folders::create_folder(&dir, &id, &name)
}

#[tauri::command]
fn folders_delete(dir: String, file_name: String) -> Result<(), String> {
    folders::delete_folder(&dir, &file_name)
}

#[tauri::command]
fn folders_rename(
    dir: String,
    file_name: String,
    new_name: String,
) -> Result<String, String> {
    folders::rename_folder(&dir, &file_name, &new_name)
}

#[tauri::command]
fn force_close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn scripts_list(data_dir: String) -> Result<scripts::ScriptsManifest, String> {
    scripts::list_scripts(&data_dir)
}

#[tauri::command]
fn scripts_venv_ready(data_dir: String) -> bool {
    script_runner::venv_status(&data_dir)
}

#[tauri::command]
fn scripts_dir_path(data_dir: String) -> String {
    scripts::scripts_dir_display(&data_dir)
}

#[tauri::command]
fn scripts_create(
    data_dir: String,
    id: String,
    name: String,
    description: String,
) -> Result<scripts::ScriptEntry, String> {
    scripts::create_script(&data_dir, id, name, description)
}

#[tauri::command]
fn scripts_update(
    data_dir: String,
    id: String,
    name: Option<String>,
    description: Option<String>,
    source: Option<String>,
) -> Result<scripts::ScriptEntry, String> {
    scripts::update_script(&data_dir, &id, name, description, source)
}

#[tauri::command]
fn scripts_delete(data_dir: String, id: String) -> Result<(), String> {
    scripts::delete_script(&data_dir, &id)
}

#[tauri::command]
fn scripts_read_source(data_dir: String, id: String) -> Result<String, String> {
    scripts::read_script_source(&data_dir, &id)
}

#[tauri::command]
async fn scripts_run_pre(
    data_dir: String,
    script_id: String,
    payload_json: String,
) -> Result<script_runner::RunScriptResult, String> {
    let entry = scripts::entry_by_id(&data_dir, &script_id)?;
    let scripts_root = script_runner::scripts_dir(&data_dir);
    let script_path = script_runner::resolve_script_path(&scripts_root, &entry.file)?;
    let mut payload: serde_json::Value =
        serde_json::from_str(&payload_json).map_err(|e| format!("Invalid payload JSON: {e}"))?;
    if let serde_json::Value::Object(ref mut map) = payload {
        map.insert(
            "scriptPath".to_string(),
            serde_json::Value::String(script_path.to_string_lossy().to_string()),
        );
        map.insert(
            "phase".to_string(),
            serde_json::Value::String("pre".to_string()),
        );
    }
    let merged = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    script_runner::run_script(&data_dir, &entry.file, &merged, None).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
            get_default_data_dir,
            ensure_data_dir,
            histories_load,
            histories_load_page,
            histories_sync,
            histories_clear,
            environments_load,
            environments_save,
            load_folders,
            folders_save,
            folders_create,
            folders_delete,
            folders_rename,
            force_close_window,
            scripts_list,
            scripts_venv_ready,
            scripts_dir_path,
            scripts_create,
            scripts_update,
            scripts_delete,
            scripts_read_source,
            scripts_run_pre,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
