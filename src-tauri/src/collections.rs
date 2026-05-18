use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const LEGACY_MONO: &str = "apilite-collections.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub params: Vec<KeyValue>,
    pub headers: Vec<KeyValue>,
    pub body_type: String,
    pub raw_content_type: String,
    pub body: String,
}

/// On-disk file: one APILite collection root (full tree in `children`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CollectionFile {
    id: String,
    name: String,
    #[serde(default)]
    collapsed: bool,
    #[serde(default)]
    children: Vec<StoredNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum StoredNode {
    #[serde(rename = "folder")]
    Folder {
        id: String,
        name: String,
        #[serde(default)]
        children: Vec<StoredNode>,
        #[serde(default)]
        collapsed: bool,
    },
    #[serde(rename = "request")]
    Request {
        id: String,
        name: String,
        request: HttpRequest,
    },
}

fn sanitize_file_stem(name: &str) -> String {
    let trimmed = name.trim();
    let mut out = String::with_capacity(trimmed.len());
    for ch in trimmed.chars() {
        if matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0') {
            out.push('-');
        } else {
            out.push(ch);
        }
    }
    let out = out.trim_matches('.').trim().to_string();
    if out.is_empty() {
        "untitled".to_string()
    } else {
        out
    }
}

fn read_collection_display_name(path: &Path) -> Result<String, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let file: CollectionFile = serde_json::from_str(&raw)
        .map_err(|e| format!("Parse {}: {}", path.display(), e))?;
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(if file.name.trim().is_empty() {
        stem
    } else {
        file.name
    })
}

fn collection_name_exists(root: &Path, name: &str, skip_file: Option<&str>) -> Result<bool, String> {
    let norm = name.trim().to_lowercase();
    if norm.is_empty() {
        return Ok(false);
    }
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if !file_name.ends_with(".json") || file_name.ends_with(".migrated") {
            continue;
        }
        if !entry.path().is_file() {
            continue;
        }
        if skip_file == Some(file_name.as_str()) {
            continue;
        }
        let display = read_collection_display_name(&entry.path())?;
        if display.trim().to_lowercase() == norm {
            return Ok(true);
        }
    }
    Ok(false)
}

fn stored_to_json_value(nodes: Vec<StoredNode>) -> Vec<serde_json::Value> {
    nodes
        .into_iter()
        .map(|n| serde_json::to_value(n).unwrap_or(serde_json::Value::Null))
        .collect()
}

fn migrate_legacy(root: &PathBuf) -> Result<(), String> {
    let legacy = root.join(LEGACY_MONO);
    if !legacy.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(&legacy).map_err(|e| e.to_string())?;
    let children: Vec<StoredNode> =
        serde_json::from_str(&raw).or_else(|_| {
            serde_json::from_str::<CollectionFile>(&raw).map(|f| f.children)
        }).unwrap_or_default();
    let id = "legacy".to_string();
    let file_name = "Default.json".to_string();
    let file = CollectionFile {
        id: id.clone(),
        name: "Default".to_string(),
        collapsed: false,
        children,
    };
    let path = root.join(&file_name);
    let data = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;
    let backup = root.join(format!("{}.migrated", LEGACY_MONO));
    let _ = fs::rename(&legacy, &backup);
    Ok(())
}

fn migrate_nested_dirs(root: &PathBuf) -> Result<(), String> {
    // Flatten old per-folder directories into one json per top-level subdir if present.
    let entries: Vec<_> = fs::read_dir(root)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .collect();
    for entry in entries {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let json_path = path.join(format!("{}.json", dir_name));
        if !json_path.exists() {
            continue;
        }
        let raw = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
        let file: CollectionFile = serde_json::from_str(&raw).unwrap_or(CollectionFile {
            id: dir_name.clone(),
            name: dir_name.clone(),
            collapsed: false,
            children: vec![],
        });
        let stem = sanitize_file_stem(&file.name);
        let out_name = format!("{}.json", stem);
        let out_path = root.join(&out_name);
        if !out_path.exists() {
            let data = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
            fs::write(&out_path, data).map_err(|e| e.to_string())?;
        }
        let _ = fs::remove_dir_all(path);
    }
    Ok(())
}

pub fn load_tree(dir: &str) -> Result<String, String> {
    let root = PathBuf::from(dir);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    migrate_legacy(&root)?;
    migrate_nested_dirs(&root)?;

    let mut roots: Vec<serde_json::Value> = Vec::new();
    let mut files: Vec<String> = Vec::new();

    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".json") || name.ends_with(".migrated") {
            continue;
        }
        if entry.path().is_file() {
            files.push(name);
        }
    }
    files.sort();

    for file_name in files {
        let path = root.join(&file_name);
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let file: CollectionFile = serde_json::from_str(&raw)
            .map_err(|e| format!("Parse {}: {}", file_name, e))?;
        let stem = file_name.strip_suffix(".json").unwrap_or(&file_name);
        roots.push(serde_json::json!({
            "id": file.id,
            "name": if file.name.is_empty() { stem } else { file.name.as_str() },
            "type": "folder",
            "collapsed": file.collapsed,
            "children": stored_to_json_value(file.children),
            "fileName": file_name,
        }));
    }

    serde_json::to_string(&roots).map_err(|e| e.to_string())
}

pub fn save_collection(dir: &str, file_name: &str, data: &str) -> Result<(), String> {
    let root = PathBuf::from(dir);
    let path = root.join(file_name);
    let _: CollectionFile = serde_json::from_str(data).map_err(|e| format!("Invalid collection data: {}", e))?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

pub fn create_collection(dir: &str, id: &str, name: &str) -> Result<String, String> {
    let root = PathBuf::from(dir);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    if collection_name_exists(&root, name, None)? {
        return Err("duplicate_collection_name".to_string());
    }
    let file_name = format!("{}.json", sanitize_file_stem(name));
    let file = CollectionFile {
        id: id.to_string(),
        name: name.to_string(),
        collapsed: false,
        children: vec![],
    };
    let data = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    fs::write(root.join(&file_name), data).map_err(|e| e.to_string())?;
    Ok(file_name)
}

pub fn delete_collection(dir: &str, file_name: &str) -> Result<(), String> {
    let path = PathBuf::from(dir).join(file_name);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn rename_collection(dir: &str, file_name: &str, new_name: &str) -> Result<String, String> {
    let root = PathBuf::from(dir);
    let old_path = root.join(file_name);
    if !old_path.exists() {
        return Err("Collection file not found".to_string());
    }
    if collection_name_exists(&root, new_name, Some(file_name))? {
        return Err("duplicate_collection_name".to_string());
    }
    let raw = fs::read_to_string(&old_path).map_err(|e| e.to_string())?;
    let mut file: CollectionFile = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    file.name = new_name.to_string();
    let new_file_name = format!("{}.json", sanitize_file_stem(new_name));
    let new_path = root.join(&new_file_name);
    let data = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;
    fs::write(&new_path, data).map_err(|e| e.to_string())?;
    if new_path != old_path {
        fs::remove_file(old_path).map_err(|e| e.to_string())?;
    }
    Ok(new_file_name)
}
