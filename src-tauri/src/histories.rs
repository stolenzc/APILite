use std::collections::{HashMap, HashSet};
use std::fs;
use chrono::{Days, Local, NaiveDate};
use serde::Serialize;
use serde_json::Value;

use crate::storage;

#[derive(Serialize)]
pub struct HistoryPageResult {
    pub entries: String,
    pub has_more: bool,
    pub total: usize,
}

const LEGACY_HISTORY_FILE: &str = "history.json";

fn histories_root(data_dir: &str) -> std::path::PathBuf {
    storage::histories_dir(data_dir)
}

fn day_file_name(day: &str) -> String {
    format!("{day}.json")
}

fn parse_day_from_file_name(name: &str) -> Option<NaiveDate> {
    let stem = name.strip_suffix(".json")?;
    NaiveDate::parse_from_str(stem, "%Y-%m-%d").ok()
}

fn cutoff_date(max_age_days: u32) -> NaiveDate {
    let today = Local::now().date_naive();
    today
        .checked_sub_days(Days::new(max_age_days as u64))
        .unwrap_or(today)
}

fn is_valid_day_key(day: &str) -> bool {
    NaiveDate::parse_from_str(day, "%Y-%m-%d").is_ok()
}

fn day_key_from_timestamp_ms(ts: i64) -> String {
    let dt = chrono::DateTime::from_timestamp_millis(ts)
        .map(|utc| utc.with_timezone(&Local))
        .unwrap_or_else(Local::now);
    dt.format("%Y-%m-%d").to_string()
}

fn group_entries_by_day(entries: &[Value]) -> HashMap<String, Vec<Value>> {
    let mut by_day: HashMap<String, Vec<Value>> = HashMap::new();
    for entry in entries {
        let ts = entry
            .get("timestamp")
            .and_then(|v| v.as_i64())
            .unwrap_or_else(|| Local::now().timestamp_millis());
        let day = day_key_from_timestamp_ms(ts);
        by_day.entry(day).or_default().push(entry.clone());
    }
    by_day
}

fn write_day_file(data_dir: &str, day: &str, data: &str) -> Result<(), String> {
    if !is_valid_day_key(day) {
        return Err(format!("Invalid history day key: {day}"));
    }
    let path = histories_root(data_dir).join(day_file_name(day));
    fs::write(path, data).map_err(|e| e.to_string())
}

fn migrate_legacy(data_dir: &str) -> Result<(), String> {
    let legacy = histories_root(data_dir).join(LEGACY_HISTORY_FILE);
    if !legacy.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(&legacy).map_err(|e| e.to_string())?;
    if let Ok(Value::Array(entries)) = serde_json::from_str::<Value>(&raw) {
        fs::create_dir_all(histories_root(data_dir)).map_err(|e| e.to_string())?;
        for (day, items) in group_entries_by_day(&entries) {
            let json = serde_json::to_string(&items).map_err(|e| e.to_string())?;
            write_day_file(data_dir, &day, &json)?;
        }
    }
    fs::remove_file(&legacy).map_err(|e| e.to_string())
}

fn prune_stale_files(
    data_dir: &str,
    keep_days: &HashSet<String>,
    max_age_days: u32,
) -> Result<(), String> {
    let dir = histories_root(data_dir);
    if !dir.exists() {
        return Ok(());
    }
    let cutoff = cutoff_date(max_age_days);
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name == LEGACY_HISTORY_FILE {
            let _ = fs::remove_file(entry.path());
            continue;
        }
        let Some(date) = parse_day_from_file_name(&name) else {
            continue;
        };
        let day_key = date.format("%Y-%m-%d").to_string();
        if date < cutoff || !keep_days.contains(&day_key) {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(())
}

fn entry_timestamp(entry: &Value) -> i64 {
    entry
        .get("timestamp")
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
}

fn load_all_entries(data_dir: &str, max_age_days: u32) -> Result<Vec<Value>, String> {
    migrate_legacy(data_dir)?;
    let dir = histories_root(data_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let cutoff = cutoff_date(max_age_days);
    let mut merged: Vec<Value> = Vec::new();

    let mut day_files: Vec<(NaiveDate, std::path::PathBuf)> = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if let Some(date) = parse_day_from_file_name(&name) {
            if date >= cutoff {
                day_files.push((date, entry.path()));
            } else {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    day_files.sort_by(|a, b| a.0.cmp(&b.0));

    for (_, path) in day_files {
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(&raw) {
            merged.extend(items);
        }
    }

    merged.sort_by(|a, b| {
        entry_timestamp(b)
            .cmp(&entry_timestamp(a))
            .then_with(|| {
                let id_a = a.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let id_b = b.get("id").and_then(|v| v.as_str()).unwrap_or("");
                id_a.cmp(id_b)
            })
    });
    Ok(merged)
}

/// Load history entries from `histories/YYYY-MM-DD.json` within the retention window.
pub fn load(data_dir: &str, max_age_days: u32) -> Result<Option<String>, String> {
    let all = load_all_entries(data_dir, max_age_days)?;
    if all.is_empty() {
        return Ok(None);
    }
    serde_json::to_string(&all).map(Some).map_err(|e| e.to_string())
}

/// Paginated load (newest first): `offset` skips entries already shown in the UI.
pub fn load_page(
    data_dir: &str,
    max_age_days: u32,
    offset: usize,
    limit: usize,
) -> Result<HistoryPageResult, String> {
    let all = load_all_entries(data_dir, max_age_days)?;
    let total = all.len();
    let has_more = total > offset + limit;
    let page: Vec<Value> = all.into_iter().skip(offset).take(limit).collect();
    Ok(HistoryPageResult {
        entries: serde_json::to_string(&page).map_err(|e| e.to_string())?,
        has_more,
        total,
    })
}

/// Write updated day files and remove stale ones.
pub fn sync(
    data_dir: &str,
    updates: HashMap<String, String>,
    keep_days: Vec<String>,
    max_age_days: u32,
) -> Result<(), String> {
    fs::create_dir_all(histories_root(data_dir)).map_err(|e| e.to_string())?;
    migrate_legacy(data_dir)?;

    for (day, data) in updates {
        write_day_file(data_dir, &day, &data)?;
    }

    let keep: HashSet<String> = keep_days.into_iter().collect();
    prune_stale_files(data_dir, &keep, max_age_days)
}

/// Remove all history day files.
pub fn clear(data_dir: &str) -> Result<(), String> {
    let dir = histories_root(data_dir);
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}
