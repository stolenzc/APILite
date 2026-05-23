use std::fs;
use std::path::{Path, PathBuf};

const FOLDERS_SUBDIR: &str = "folders";
const HISTORIES_SUBDIR: &str = "histories";
const ENVIRONMENTS_FILE: &str = "environments.json";

pub fn default_data_dir() -> Result<String, String> {
    let home = dirs_next::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".APILite").to_string_lossy().to_string())
}

pub fn folders_dir(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join(FOLDERS_SUBDIR)
}

pub fn environments_file(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join(ENVIRONMENTS_FILE)
}

pub fn histories_dir(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join(HISTORIES_SUBDIR)
}

pub fn ensure_data_dir(data_dir: &str) -> Result<(), String> {
    fs::create_dir_all(folders_dir(data_dir)).map_err(|e| e.to_string())?;
    fs::create_dir_all(histories_dir(data_dir)).map_err(|e| e.to_string())
}
