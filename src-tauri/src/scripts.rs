use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::script_runner;
use crate::storage;

pub const MANIFEST_FILE: &str = "scripts.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptEntry {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub file: String,
    #[serde(default)]
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptsManifest {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub scripts: Vec<ScriptEntry>,
}

fn default_version() -> u32 {
    1
}

impl Default for ScriptsManifest {
    fn default() -> Self {
        Self {
            version: 1,
            scripts: Vec::new(),
        }
    }
}

pub fn manifest_path(data_dir: &str) -> std::path::PathBuf {
    script_runner::scripts_dir(data_dir).join(MANIFEST_FILE)
}

pub fn load_manifest(data_dir: &str) -> Result<ScriptsManifest, String> {
    storage::ensure_data_dir(data_dir)?;
    let path = manifest_path(data_dir);
    if !path.is_file() {
        return Ok(ScriptsManifest::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid scripts.json: {e}"))
}

pub fn save_manifest(data_dir: &str, manifest: &ScriptsManifest) -> Result<(), String> {
    storage::ensure_data_dir(data_dir)?;
    let path = manifest_path(data_dir);
    let json = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn sanitize_filename(stem: &str) -> String {
    let mut out = String::new();
    for ch in stem.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            out.push(ch.to_lowercase().next().unwrap_or(ch));
        } else if ch.is_whitespace() {
            out.push('_');
        }
    }
    if out.is_empty() {
        out.push_str("script");
    }
    out
}

fn unique_file_name(data_dir: &str, stem: &str) -> Result<String, String> {
    let dir = script_runner::scripts_dir(data_dir);
    let base = sanitize_filename(stem);
    let mut candidate = format!("{base}.py");
    let mut n = 1;
    while dir.join(&candidate).exists() {
        candidate = format!("{base}_{n}.py");
        n += 1;
    }
    Ok(candidate)
}

const SCRIPT_TEMPLATE: &str = r#"def run(ctx):
    """Pre-request script. ctx has request, env, vars. Return dict with ok, vars, request."""
    # request.body = raw editor text; request.bodyJson = parsed JSON when body is JSON/JSONC
    # req = ctx.get("request", {})
    # body = req.get("bodyJson")
    # if body is None:
    #     return {"ok": False, "error": req.get("bodyParseError") or "Body is empty or not valid JSON"}
    # return {"ok": True, "vars": {"example": "value"}}
    return {"ok": True, "vars": {}}
"#;

pub fn list_scripts(data_dir: &str) -> Result<ScriptsManifest, String> {
    let _ = script_runner::ensure_runner(data_dir)?;
    load_manifest(data_dir)
}

pub fn create_script(
    data_dir: &str,
    id: String,
    name: String,
    description: String,
) -> Result<ScriptEntry, String> {
    let mut manifest = load_manifest(data_dir)?;
    if manifest.scripts.iter().any(|s| s.id == id) {
        return Err("Script id already exists".to_string());
    }
    let file = unique_file_name(data_dir, &name)?;
    let path = script_runner::scripts_dir(data_dir).join(&file);
    fs::write(&path, SCRIPT_TEMPLATE).map_err(|e| e.to_string())?;
    let entry = ScriptEntry {
        id,
        name,
        description,
        file,
        updated_at: now_ms(),
    };
    manifest.scripts.push(entry.clone());
    save_manifest(data_dir, &manifest)?;
    Ok(entry)
}

pub fn update_script(
    data_dir: &str,
    id: &str,
    name: Option<String>,
    description: Option<String>,
    source: Option<String>,
) -> Result<ScriptEntry, String> {
    let mut manifest = load_manifest(data_dir)?;
    let entry = manifest
        .scripts
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| "Script not found".to_string())?;
    if let Some(n) = name {
        entry.name = n;
    }
    if let Some(d) = description {
        entry.description = d;
    }
    entry.updated_at = now_ms();
    let file = entry.file.clone();
    let entry_clone = entry.clone();
    if let Some(src) = source {
        let path = script_runner::scripts_dir(data_dir).join(&file);
        fs::write(path, src).map_err(|e| e.to_string())?;
    }
    save_manifest(data_dir, &manifest)?;
    Ok(entry_clone)
}

pub fn delete_script(data_dir: &str, id: &str) -> Result<(), String> {
    let mut manifest = load_manifest(data_dir)?;
    let idx = manifest
        .scripts
        .iter()
        .position(|s| s.id == id)
        .ok_or_else(|| "Script not found".to_string())?;
    let removed = manifest.scripts.remove(idx);
    let path = script_runner::scripts_dir(data_dir).join(&removed.file);
    if path.is_file() {
        let _ = fs::remove_file(path);
    }
    save_manifest(data_dir, &manifest)
}

pub fn read_script_source(data_dir: &str, id: &str) -> Result<String, String> {
    let manifest = load_manifest(data_dir)?;
    let entry = manifest
        .scripts
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "Script not found".to_string())?;
    fs::read_to_string(script_runner::scripts_dir(data_dir).join(&entry.file))
        .map_err(|e| e.to_string())
}

pub fn entry_by_id(data_dir: &str, id: &str) -> Result<ScriptEntry, String> {
    let manifest = load_manifest(data_dir)?;
    manifest
        .scripts
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "Script not found".to_string())
}

pub fn scripts_dir_display(data_dir: &str) -> String {
    script_runner::scripts_dir(data_dir).to_string_lossy().to_string()
}
