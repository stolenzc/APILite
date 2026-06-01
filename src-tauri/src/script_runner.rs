use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

const RUNNER_FILENAME: &str = ".apilite_runner.py";
const DEFAULT_TIMEOUT_SECS: u64 = 30;

const RUNNER_SOURCE: &str = r#"import json
import sys
import importlib.util
from pathlib import Path

def main() -> None:
    payload = json.load(sys.stdin)
    script_path = Path(payload["scriptPath"])
    spec = importlib.util.spec_from_file_location("apilite_user_script", script_path)
    if spec is None or spec.loader is None:
        print(json.dumps({"ok": False, "error": f"Cannot load script: {script_path}"}))
        return
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "run"):
        print(json.dumps({"ok": False, "error": "Script must define run(ctx) -> dict"}))
        return
    try:
        result = mod.run(payload)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return
    if not isinstance(result, dict):
        print(json.dumps({"ok": False, "error": "run(ctx) must return a dict"}))
        return
    print(json.dumps(result))

if __name__ == "__main__":
    main()
"#;

#[derive(Debug, Serialize, Deserialize)]
pub struct RunScriptResult {
    pub ok: bool,
    #[serde(default)]
    pub vars: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    pub request: Option<serde_json::Value>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub stderr: Option<String>,
    #[serde(default)]
    pub duration_ms: u64,
}

pub fn scripts_dir(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join(crate::storage::SCRIPTS_SUBDIR)
}

pub fn venv_python(data_dir: &str) -> Result<PathBuf, String> {
    let base = scripts_dir(data_dir).join(".venv");
    let python = if cfg!(windows) {
        base.join("Scripts").join("python.exe")
    } else {
        base.join("bin").join("python")
    };
    if !python.is_file() {
        return Err(
            "Python venv not found. Create it: cd <dataDir>/scripts && python3 -m venv .venv"
                .to_string(),
        );
    }
    Ok(python)
}

pub fn write_if_changed(path: &std::path::Path, content: &str) -> Result<(), String> {
    if path.is_file() {
        if let Ok(existing) = std::fs::read_to_string(path) {
            if existing == content {
                return Ok(());
            }
        }
    } else if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, content).map_err(|e| e.to_string())
}

pub fn ensure_runner(data_dir: &str) -> Result<PathBuf, String> {
    let path = scripts_dir(data_dir).join(RUNNER_FILENAME);
    write_if_changed(&path, RUNNER_SOURCE)?;
    Ok(path)
}

pub fn venv_status(data_dir: &str) -> bool {
    venv_python(data_dir).is_ok()
}

/// Run a user script with JSON payload on stdin; expects JSON object on stdout.
/// When `use_daemon` is false (simple mode), each run spawns a fresh Python process.
pub async fn run_script(
    data_dir: &str,
    script_rel_path: &str,
    payload_json: &str,
    timeout_secs: Option<u64>,
    use_daemon: bool,
) -> Result<RunScriptResult, String> {
    let scripts_root = scripts_dir(data_dir);
    let _script_path = resolve_script_path(&scripts_root, script_rel_path)?;

    if use_daemon {
        match crate::script_daemon::run_script_via_daemon(data_dir, payload_json, timeout_secs).await
        {
            Ok(result) => return Ok(result),
            Err(daemon_err) => {
                eprintln!("Script daemon unavailable, falling back to one-shot: {daemon_err}");
            }
        }
    }

    run_script_oneshot(data_dir, payload_json, timeout_secs).await
}

async fn run_script_oneshot(
    data_dir: &str,
    payload_json: &str,
    timeout_secs: Option<u64>,
) -> Result<RunScriptResult, String> {
    let started = Instant::now();
    let scripts_root = scripts_dir(data_dir);
    let runner_path = ensure_runner(data_dir)?;
    let python = venv_python(data_dir)?;

    let mut child = Command::new(&python)
        .arg(&runner_path)
        .current_dir(&scripts_root)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start Python: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(payload_json.as_bytes())
            .await
            .map_err(|e| format!("Failed to write script stdin: {e}"))?;
    }

    let timeout = Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));
    let output = tokio::time::timeout(timeout, child.wait_with_output())
        .await
        .map_err(|_| format!("Script timed out after {} seconds", timeout.as_secs()))?
        .map_err(|e| format!("Failed to run script: {e}"))?;

    let duration_ms = started.elapsed().as_millis() as u64;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() && stdout.is_empty() {
        return Ok(RunScriptResult {
            ok: false,
            vars: serde_json::Map::new(),
            request: None,
            error: Some(if stderr.is_empty() {
                format!("Script exited with code {:?}", output.status.code())
            } else {
                stderr.clone()
            }),
            stderr: if stderr.is_empty() { None } else { Some(stderr) },
            duration_ms,
        });
    }

    let parsed: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| {
        format!(
            "Invalid script stdout (expected JSON): {e}\nstdout: {stdout}\nstderr: {stderr}"
        )
    })?;

    Ok(RunScriptResult {
        ok: parsed
            .get("ok")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        vars: parsed
            .get("vars")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default(),
        request: parsed.get("request").cloned(),
        error: parsed
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        stderr: if stderr.is_empty() { None } else { Some(stderr) },
        duration_ms,
    })
}

pub fn resolve_script_path(scripts_root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let rel = Path::new(rel_path);
    if rel.is_absolute() || rel.components().any(|c| c == std::path::Component::ParentDir) {
        return Err("Invalid script path".to_string());
    }
    let joined = scripts_root.join(rel);
    let canonical_root = scripts_root
        .canonicalize()
        .unwrap_or_else(|_| scripts_root.to_path_buf());
    let canonical_script = joined
        .canonicalize()
        .map_err(|_| "Script file not found".to_string())?;
    if !canonical_script.starts_with(&canonical_root) {
        return Err("Script path escapes scripts directory".to_string());
    }
    if !canonical_script.is_file() {
        return Err("Script file not found".to_string());
    }
    Ok(canonical_script)
}
