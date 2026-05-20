use std::fs;

use crate::storage;

pub fn load(data_dir: &str) -> Result<Option<String>, String> {
    let path = storage::environments_file(data_dir);
    if path.exists() {
        return fs::read_to_string(&path).map(Some).map_err(|e| e.to_string());
    }

    // One-time migration from legacy ~/.APILite/environments.json
    let legacy = storage::legacy_data_dir()?.join("environments.json");
    if legacy.exists() && legacy != path {
        let data = fs::read_to_string(&legacy).map_err(|e| e.to_string())?;
        save(data_dir, &data)?;
        return Ok(Some(data));
    }

    Ok(None)
}

pub fn save(data_dir: &str, data: &str) -> Result<(), String> {
    let root = storage::environments_file(data_dir)
        .parent()
        .ok_or_else(|| "Invalid data directory".to_string())?
        .to_path_buf();
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let path = storage::environments_file(data_dir);
    fs::write(&path, data).map_err(|e| e.to_string())
}
