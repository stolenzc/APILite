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

fn write_day_file(data_dir: &str, day: &str, data: &str) -> Result<(), String> {
    if !is_valid_day_key(day) {
        return Err(format!("Invalid history day key: {day}"));
    }
    let path = histories_root(data_dir).join(day_file_name(day));
    fs::write(path, data).map_err(|e| e.to_string())
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

fn entry_id(entry: &Value) -> &str {
    entry
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
}

fn compare_entries_desc(a: &Value, b: &Value) -> std::cmp::Ordering {
    entry_timestamp(b)
        .cmp(&entry_timestamp(a))
        .then_with(|| entry_id(a).cmp(entry_id(b)))
}

fn sort_entries_newest_first(entries: &mut [Value]) {
    entries.sort_by(compare_entries_desc);
}

fn read_day_entries(path: &std::path::Path) -> Result<Vec<Value>, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<Value>(&raw) {
        Ok(Value::Array(mut items)) => {
            sort_entries_newest_first(&mut items);
            Ok(items)
        }
        Ok(_) => Ok(Vec::new()),
        Err(e) => Err(e.to_string()),
    }
}

fn newest_day_file_within_retention(
    data_dir: &str,
    max_age_days: u32,
) -> Result<Option<std::path::PathBuf>, String> {
    let dir = histories_root(data_dir);
    if !dir.exists() {
        return Ok(None);
    }
    let cutoff = cutoff_date(max_age_days);
    let mut newest: Option<(NaiveDate, std::path::PathBuf)> = None;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let Some(date) = parse_day_from_file_name(&name) else {
            continue;
        };
        if date < cutoff {
            continue;
        }
        match &newest {
            None => newest = Some((date, entry.path())),
            Some((d, _)) if date > *d => newest = Some((date, entry.path())),
            _ => {}
        }
    }
    Ok(newest.map(|(_, p)| p))
}

/// Day shards within retention, each sorted newest-first; outer vec is newest day first.
fn load_day_shards(data_dir: &str, max_age_days: u32) -> Result<Vec<Vec<Value>>, String> {
    let dir = histories_root(data_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let cutoff = cutoff_date(max_age_days);
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
    day_files.sort_by(|a, b| b.0.cmp(&a.0));

    let mut shards = Vec::with_capacity(day_files.len());
    for (_, path) in day_files {
        let items = read_day_entries(&path)?;
        if !items.is_empty() {
            shards.push(items);
        }
    }
    Ok(shards)
}

fn total_entry_count(shards: &[Vec<Value>]) -> usize {
    shards.iter().map(|s| s.len()).sum()
}

/// K-way merge across day shards (each newest-first) without materializing the full list.
fn page_from_shards(shards: &[Vec<Value>], offset: usize, limit: usize) -> Vec<Value> {
    if limit == 0 || shards.is_empty() {
        return Vec::new();
    }

    let mut cursors = vec![0usize; shards.len()];
    let mut skipped = 0usize;
    let mut page = Vec::with_capacity(limit);

    loop {
        if page.len() >= limit {
            break;
        }

        let mut best_shard: Option<usize> = None;
        let mut best_ts = i64::MIN;
        let mut best_id = "";

        for (i, shard) in shards.iter().enumerate() {
            let idx = cursors[i];
            if idx >= shard.len() {
                continue;
            }
            let entry = &shard[idx];
            let ts = entry_timestamp(entry);
            let id = entry_id(entry);
            let better = match best_shard {
                None => true,
                Some(_) => ts > best_ts || (ts == best_ts && id > best_id),
            };
            if better {
                best_ts = ts;
                best_id = id;
                best_shard = Some(i);
            }
        }

        let Some(i) = best_shard else {
            break;
        };

        let picked = shards[i][cursors[i]].clone();
        cursors[i] += 1;

        if skipped < offset {
            skipped += 1;
            continue;
        }
        page.push(picked);
    }

    page
}

fn merge_all_entries(shards: &[Vec<Value>]) -> Vec<Value> {
    let total = total_entry_count(shards);
    let mut merged = Vec::with_capacity(total);
    let limit = total;
    merged.extend(page_from_shards(shards, 0, limit));
    merged
}

fn load_all_entries(data_dir: &str, max_age_days: u32) -> Result<Vec<Value>, String> {
    let shards = load_day_shards(data_dir, max_age_days)?;
    Ok(merge_all_entries(&shards))
}

fn group_entries_by_day(entries: &[Value]) -> HashMap<String, Vec<Value>> {
    let mut by_day: HashMap<String, Vec<Value>> = HashMap::new();
    for entry in entries {
        let ts = entry_timestamp(entry);
        let day = {
            let dt = chrono::DateTime::from_timestamp_millis(ts)
                .unwrap_or_else(|| Local::now().into());
            dt.date_naive().format("%Y-%m-%d").to_string()
        };
        by_day.entry(day).or_default().push(entry.clone());
    }
    for items in by_day.values_mut() {
        sort_entries_newest_first(items);
    }
    by_day
}

fn sync_entries(data_dir: &str, entries: &[Value], max_age_days: u32) -> Result<(), String> {
    fs::create_dir_all(histories_root(data_dir)).map_err(|e| e.to_string())?;
    let by_day = group_entries_by_day(entries);
    let keep_days: Vec<String> = by_day.keys().cloned().collect();
    for (day, items) in &by_day {
        let data = serde_json::to_string(items).map_err(|e| e.to_string())?;
        write_day_file(data_dir, day, &data)?;
    }
    let keep: HashSet<String> = keep_days.into_iter().collect();
    prune_stale_files(data_dir, &keep, max_age_days)
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
    let shards = load_day_shards(data_dir, max_age_days)?;
    let total = total_entry_count(&shards);
    let has_more = total > offset.saturating_add(limit);
    let page = page_from_shards(&shards, offset, limit);
    Ok(HistoryPageResult {
        entries: serde_json::to_string(&page).map_err(|e| e.to_string())?,
        has_more,
        total,
    })
}

/// Initial load used when the history panel is expanded.
/// - If the newest day file is small, return all entries from that file.
/// - If it's large, return only the first `limit` entries (newest-first).
pub fn load_initial(
    data_dir: &str,
    max_age_days: u32,
    limit: usize,
    small_file_bytes: u64,
) -> Result<HistoryPageResult, String> {
    let newest_path = newest_day_file_within_retention(data_dir, max_age_days)?;

    // Determine whether there is more to load (across all days) cheaply.
    let shards = load_day_shards(data_dir, max_age_days)?;
    let total = total_entry_count(&shards);

    let mut entries: Vec<Value> = match newest_path {
        None => Vec::new(),
        Some(ref path) => {
            let size = fs::metadata(path).map(|m| m.len()).unwrap_or(u64::MAX);
            let mut items = read_day_entries(path)?;
            if size > small_file_bytes && items.len() > limit {
                items.truncate(limit);
            }
            items
        }
    };
    // Ensure newest-first even if file had weird order.
    sort_entries_newest_first(&mut entries);

    let has_more = total > entries.len();
    Ok(HistoryPageResult {
        entries: serde_json::to_string(&entries).map_err(|e| e.to_string())?,
        has_more,
        total,
    })
}

/// Prepend one entry to a day shard; run a full prune only when over `max_count`.
pub fn append_entry(
    data_dir: &str,
    day: &str,
    entry: Value,
    max_age_days: u32,
    max_count: usize,
) -> Result<(), String> {
    if !is_valid_day_key(day) {
        return Err(format!("Invalid history day key: {day}"));
    }
    fs::create_dir_all(histories_root(data_dir)).map_err(|e| e.to_string())?;

    let path = histories_root(data_dir).join(day_file_name(day));
    let mut items = if path.exists() {
        read_day_entries(&path)?
    } else {
        Vec::new()
    };

    let new_id = entry.get("id").and_then(|v| v.as_str());
    if let Some(id) = new_id {
        items.retain(|e| e.get("id").and_then(|v| v.as_str()) != Some(id));
    }
    items.insert(0, entry);
    let data = serde_json::to_string(&items).map_err(|e| e.to_string())?;
    write_day_file(data_dir, day, &data)?;

    let shards = load_day_shards(data_dir, max_age_days)?;
    let total = total_entry_count(&shards);
    if total <= max_count {
        return Ok(());
    }

    let mut all = merge_all_entries(&shards);
    let min_ts = Local::now()
        .timestamp_millis()
        .saturating_sub(i64::from(max_age_days) * 86_400_000);
    all.retain(|e| entry_timestamp(e) >= min_ts);
    if all.len() > max_count {
        all.truncate(max_count);
    }
    sync_entries(data_dir, &all, max_age_days)
}

/// Write updated day files and remove stale ones.
pub fn sync(
    data_dir: &str,
    updates: HashMap<String, String>,
    keep_days: Vec<String>,
    max_age_days: u32,
) -> Result<(), String> {
    fs::create_dir_all(histories_root(data_dir)).map_err(|e| e.to_string())?;

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
