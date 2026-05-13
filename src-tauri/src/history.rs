use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub time: String,
    pub method: String,
    pub url: String,
    pub status: u16,
}

pub struct HistoryStore {
    entries: Mutex<Vec<HistoryEntry>>,
}

impl HistoryStore {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(Vec::with_capacity(50)),
        }
    }

    pub fn add(&self, entry: HistoryEntry) {
        let mut entries = self.entries.lock().unwrap();
        entries.insert(0, entry);
        if entries.len() > 50 {
            entries.truncate(50);
        }
    }

    pub fn get(&self) -> Vec<HistoryEntry> {
        self.entries.lock().unwrap().clone()
    }

    pub fn clear(&self) {
        self.entries.lock().unwrap().clear();
    }
}
