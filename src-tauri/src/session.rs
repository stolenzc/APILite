use std::fs;

use crate::storage;

pub fn load(data_dir: &str) -> Result<Option<String>, String> {
    let path = storage::session_file(data_dir);
    if path.exists() {
        return fs::read_to_string(&path).map(Some).map_err(|e| e.to_string());
    }
    Ok(None)
}

pub fn save(data_dir: &str, data: &str) -> Result<(), String> {
    let root = storage::session_file(data_dir)
        .parent()
        .ok_or_else(|| "Invalid data directory".to_string())?
        .to_path_buf();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let path = storage::session_file(data_dir);
    fs::write(&path, data).map_err(|e| e.to_string())
}

pub fn clear(data_dir: &str) -> Result<(), String> {
    let path = storage::session_file(data_dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
