use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;
use tokio::time;

use crate::script_runner::{self, RunScriptResult};

const DAEMON_FILENAME: &str = ".apilite_daemon.py";

const DAEMON_SOURCE: &str = r#"import json
import sys
import importlib.util
from pathlib import Path

def _load_module(script_path: str):
    """Load script from disk every time (no module cache) so edits take effect immediately."""
    path = Path(script_path)
    mod_name = f"apilite_user_{path.stem}"
    sys.modules.pop(mod_name, None)
    spec = importlib.util.spec_from_file_location(mod_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load script: {script_path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            script_path = payload.get("scriptPath")
            if not script_path:
                print(json.dumps({"ok": False, "error": "Missing scriptPath"}), flush=True)
                continue
            mod = _load_module(script_path)
            if not hasattr(mod, "run"):
                print(json.dumps({"ok": False, "error": "Script must define run(ctx) -> dict"}), flush=True)
                continue
            result = mod.run(payload)
            if not isinstance(result, dict):
                print(json.dumps({"ok": False, "error": "run(ctx) must return a dict"}), flush=True)
                continue
            print(json.dumps(result), flush=True)
        except Exception as exc:
            print(json.dumps({"ok": False, "error": str(exc)}), flush=True)

if __name__ == "__main__":
    main()
"#;

struct DaemonProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<tokio::process::ChildStdout>,
}

static DAEMONS: OnceLock<Mutex<HashMap<String, DaemonProcess>>> = OnceLock::new();
static DAEMON_SOURCE_FP: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();

fn daemons() -> &'static Mutex<HashMap<String, DaemonProcess>> {
    DAEMONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn daemon_source_fingerprint() -> u64 {
    let mut h = DefaultHasher::new();
    DAEMON_SOURCE.hash(&mut h);
    h.finish()
}

pub fn ensure_daemon_script(data_dir: &str) -> Result<PathBuf, String> {
    let path = script_runner::scripts_dir(data_dir).join(DAEMON_FILENAME);
    script_runner::write_if_changed(&path, DAEMON_SOURCE)?;
    Ok(path)
}

pub async fn stop_daemon(data_dir: &str) {
    let mut map = daemons().lock().await;
    if let Some(mut proc) = map.remove(data_dir) {
        let _ = proc.child.kill().await;
    }
}

async fn spawn_daemon(data_dir: &str) -> Result<(), String> {
    stop_daemon(data_dir).await;

    let scripts_root = script_runner::scripts_dir(data_dir);
    let daemon_path = ensure_daemon_script(data_dir)?;
    let python = script_runner::venv_python(data_dir)?;

    let mut child = Command::new(&python)
        .arg(&daemon_path)
        .current_dir(&scripts_root)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .env("PYTHONUNBUFFERED", "1")
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start script daemon: {e}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Script daemon stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Script daemon stdout unavailable".to_string())?;

    let mut map = daemons().lock().await;
    map.insert(
        data_dir.to_string(),
        DaemonProcess {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        },
    );
    Ok(())
}

async fn ensure_daemon_running(data_dir: &str) -> Result<(), String> {
    let fp = daemon_source_fingerprint();
    let fps = DAEMON_SOURCE_FP.get_or_init(|| Mutex::new(HashMap::new()));
    let mut fp_map = fps.lock().await;
    if fp_map.get(data_dir) != Some(&fp) {
        fp_map.insert(data_dir.to_string(), fp);
        drop(fp_map);
        stop_daemon(data_dir).await;
    } else {
        drop(fp_map);
    }

    let mut map = daemons().lock().await;
    if let Some(proc) = map.get_mut(data_dir) {
        match proc.child.try_wait() {
            Ok(None) => return Ok(()),
            Ok(Some(_status)) => {}
            Err(_) => {}
        }
        map.remove(data_dir);
    }
    drop(map);
    spawn_daemon(data_dir).await
}

fn parse_script_stdout(stdout: &str, stderr: &str, duration_ms: u64) -> Result<RunScriptResult, String> {
    let parsed: serde_json::Value = serde_json::from_str(stdout).map_err(|e| {
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
        stderr: if stderr.is_empty() {
            None
        } else {
            Some(stderr.to_string())
        },
        duration_ms,
    })
}

/// Run via long-lived Python daemon (reloads script file each request). Falls back to one-shot on failure.
pub async fn run_script_via_daemon(
    data_dir: &str,
    payload_json: &str,
    timeout_secs: Option<u64>,
) -> Result<RunScriptResult, String> {
    let started = Instant::now();
    let timeout = Duration::from_secs(timeout_secs.unwrap_or(30));

    for attempt in 0..2 {
        ensure_daemon_running(data_dir).await?;

        let line = format!("{payload_json}\n");
        let read_fut = async {
            let mut map = daemons().lock().await;
            let proc = map
                .get_mut(data_dir)
                .ok_or_else(|| "Script daemon not running".to_string())?;
            proc.stdin
                .write_all(line.as_bytes())
                .await
                .map_err(|e| format!("Failed to write script daemon stdin: {e}"))?;
            proc.stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush script daemon stdin: {e}"))?;

            let mut out_line = String::new();
            proc.stdout
                .read_line(&mut out_line)
                .await
                .map_err(|e| format!("Failed to read script daemon stdout: {e}"))?;
            Ok::<String, String>(out_line.trim().to_string())
        };

        match time::timeout(timeout, read_fut).await {
            Ok(Ok(stdout)) if !stdout.is_empty() => {
                return parse_script_stdout(&stdout, "", started.elapsed().as_millis() as u64);
            }
            Ok(Ok(_)) => {
                stop_daemon(data_dir).await;
                if attempt == 0 {
                    continue;
                }
                return Err("Script daemon returned empty response".to_string());
            }
            Ok(Err(e)) => {
                stop_daemon(data_dir).await;
                if attempt == 0 {
                    continue;
                }
                return Err(e);
            }
            Err(_) => {
                stop_daemon(data_dir).await;
                return Err(format!(
                    "Script timed out after {} seconds",
                    timeout.as_secs()
                ));
            }
        }
    }

    Err("Script daemon failed".to_string())
}
