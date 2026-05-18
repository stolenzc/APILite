use std::fs;
use std::path::PathBuf;

fn apilite_dir() -> Result<PathBuf, String> {
    let home = dirs_next::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".APILite"))
}

fn environments_file() -> Result<PathBuf, String> {
    Ok(apilite_dir()?.join("environments.json"))
}

pub fn load() -> Result<Option<String>, String> {
    let path = environments_file()?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

pub fn save(data: &str) -> Result<(), String> {
    let dir = apilite_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = environments_file()?;
    fs::write(&path, data).map_err(|e| e.to_string())
}
