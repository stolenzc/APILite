use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct ExportRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    #[serde(rename = "bodyType")]
    pub body_type: String,
    pub body: Option<String>,
}

pub fn to_curl(req: ExportRequest) -> String {
    let mut parts = vec!["curl".to_string()];

    // Method
    if req.method != "GET" || req.body.is_some() {
        parts.push(format!("-X {}", req.method));
    }

    // URL
    parts.push(format!("'{}'", escape_single_quotes(&req.url)));

    // Headers
    for (key, value) in &req.headers {
        if !key.is_empty() {
            parts.push(format!("-H '{}: {}'", key, escape_single_quotes(value)));
        }
    }

    // Auto-set Content-Type for known body types
    match req.body_type.as_str() {
        "json" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: application/json'".to_string());
        }
        "xml" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: application/xml'".to_string());
        }
        _ => {}
    }

    // Body
    if let Some(body) = &req.body {
        if !body.is_empty() && req.body_type != "none" {
            parts.push(format!("-d '{}'", escape_single_quotes(body)));
        }
    }

    parts.join(" ")
}

fn escape_single_quotes(s: &str) -> String {
    s.replace('\'', "'\\''")
}
