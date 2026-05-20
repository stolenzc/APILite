use std::fs;
use std::path::{Path, PathBuf};

const COLLECTIONS_SUBDIR: &str = "collections";
const ENVIRONMENTS_FILE: &str = "environments.json";

pub fn default_data_dir() -> Result<String, String> {
    let home = dirs_next::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".APILite").to_string_lossy().to_string())
}

pub fn legacy_data_dir() -> Result<PathBuf, String> {
    let home = dirs_next::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".APILite"))
}

pub fn collections_dir(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join(COLLECTIONS_SUBDIR)
}

pub fn environments_file(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join(ENVIRONMENTS_FILE)
}

pub fn ensure_data_dir(data_dir: &str) -> Result<(), String> {
    fs::create_dir_all(collections_dir(data_dir)).map_err(|e| e.to_string())
}
