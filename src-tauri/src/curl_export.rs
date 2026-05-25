use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct FormFieldPart {
    pub key: String,
    pub value: Option<String>,
    #[serde(rename = "filePath", default)]
    pub file_path: Option<String>,
    #[serde(rename = "fileName", default)]
    pub file_name: Option<String>,
    #[serde(rename = "fileDataBase64", default)]
    pub file_data_base64: Option<String>,
}

#[derive(Deserialize)]
pub struct ExportRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    #[serde(rename = "bodyType")]
    pub body_type: String,
    pub body: Option<String>,
    #[serde(rename = "formFields", default)]
    pub form_fields: Vec<FormFieldPart>,
    #[serde(rename = "binaryFilePath", default)]
    pub binary_file_path: Option<String>,
    #[serde(rename = "binaryFileName", default)]
    pub binary_file_name: Option<String>,
    #[serde(rename = "binaryDataBase64", default)]
    pub binary_data_base64: Option<String>,
}

pub fn to_curl(req: ExportRequest) -> String {
    let mut parts = vec!["curl".to_string()];

    if req.method != "GET" || req.body.is_some() || !req.form_fields.is_empty() || req.binary_file_path.is_some() {
        parts.push(format!("-X {}", req.method));
    }

    parts.push(format!("'{}'", escape_single_quotes(&req.url)));

    for (key, value) in &req.headers {
        if !key.is_empty() {
            parts.push(format!("-H '{}: {}'", key, escape_single_quotes(value)));
        }
    }

    match req.body_type.as_str() {
        "json" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: application/json'".to_string());
        }
        "xml" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: application/xml'".to_string());
        }
        "html" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: text/html'".to_string());
        }
        "text" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: text/plain'".to_string());
        }
        "javascript" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: application/javascript'".to_string());
        }
        "x-www-form-urlencoded" if !req.headers.contains_key("Content-Type") => {
            parts.push("-H 'Content-Type: application/x-www-form-urlencoded'".to_string());
        }
        _ => {}
    }

    if req.body_type == "form-data" && !req.form_fields.is_empty() {
        for field in &req.form_fields {
            if field.key.is_empty() {
                continue;
            }
            if let Some(path) = &field.file_path {
                let name = field
                    .file_name
                    .as_deref()
                    .unwrap_or_else(|| path.split(['/', '\\']).last().unwrap_or("file"));
                parts.push(format!(
                    "-F '{}=@{};filename={}'",
                    escape_single_quotes(&field.key),
                    escape_single_quotes(path),
                    escape_single_quotes(name),
                ));
            } else if field.file_data_base64.is_some() {
                parts.push(format!(
                    "-F '{}=<(base64 file data)>'",
                    escape_single_quotes(&field.key),
                ));
            } else if let Some(value) = &field.value {
                parts.push(format!(
                    "-F '{}={}'",
                    escape_single_quotes(&field.key),
                    escape_single_quotes(value),
                ));
            }
        }
    } else if req.body_type == "binary" {
        if let Some(path) = &req.binary_file_path {
            parts.push(format!("--data-binary '@{}'", escape_single_quotes(path)));
        } else if req.binary_data_base64.is_some() {
            let label = req
                .binary_file_name
                .as_deref()
                .unwrap_or("file");
            parts.push(format!("--data-binary '<(base64: {})>'", escape_single_quotes(label)));
        }
    } else if let Some(body) = &req.body {
        if !body.is_empty() && req.body_type != "none" {
            parts.push(format!("-d '{}'", escape_single_quotes(body)));
        }
    }

    format_multiline_curl(&parts)
}

const CURL_LINE_INDENT: &str = "  ";
/// Max length for grouping `curl`, `-X`, and URL on one line.
const CURL_FIRST_LINE_MAX: usize = 120;

fn format_multiline_curl(parts: &[String]) -> String {
    if parts.is_empty() {
        return String::new();
    }
    if parts.len() == 1 {
        return parts[0].clone();
    }

    let first_line_len = if parts.len() > 1 && parts[1].starts_with("-X ") {
        3.min(parts.len())
    } else {
        2.min(parts.len())
    };

    // Only curl (+ optional -X) + URL — no headers/body to break out.
    if first_line_len >= parts.len() {
        return parts[..first_line_len].join(" ");
    }

    let mut lines = Vec::with_capacity(parts.len());
    push_first_line_group(&mut lines, &parts[..first_line_len]);

    for (i, part) in parts.iter().enumerate().skip(first_line_len) {
        if i == parts.len() - 1 {
            lines.push(format!("{}{}", CURL_LINE_INDENT, part));
        } else {
            lines.push(format!("{}{} \\", CURL_LINE_INDENT, part));
        }
    }
    lines.join("\n")
}

fn push_first_line_group(lines: &mut Vec<String>, first_parts: &[String]) {
    let joined = first_parts.join(" ");
    if joined.len() <= CURL_FIRST_LINE_MAX {
        lines.push(format!("{} \\", joined));
        return;
    }

    if first_parts.len() >= 3 {
        lines.push(format!("{} {} \\", first_parts[0], first_parts[1]));
        lines.push(format!("{}{} \\", CURL_LINE_INDENT, first_parts[2]));
    } else if first_parts.len() == 2 {
        lines.push(format!("{} \\", first_parts[0]));
        lines.push(format!("{}{} \\", CURL_LINE_INDENT, first_parts[1]));
    } else {
        lines.push(format!("{} \\", joined));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_line_only_stays_single_line() {
        let parts = vec![
            "curl".into(),
            "-X POST".into(),
            "'https://api.example.com'".into(),
        ];
        assert_eq!(
            format_multiline_curl(&parts),
            "curl -X POST 'https://api.example.com'"
        );
    }

    #[test]
    fn short_with_headers_still_multiline() {
        let parts = vec![
            "curl".into(),
            "'https://api.example.com'".into(),
            "-H 'Accept: application/json'".into(),
        ];
        assert_eq!(
            format_multiline_curl(&parts),
            "curl 'https://api.example.com' \\\n  -H 'Accept: application/json'"
        );
    }

    #[test]
    fn long_command_groups_first_line() {
        let parts = vec![
            "curl".into(),
            "-X POST".into(),
            "'https://api.example.com/v1/resources/items'".into(),
            "-H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0'".into(),
            "-H 'X-Custom-Header: another-value'".into(),
            "-d '{\"key\":\"value\",\"nested\":{\"a\":1}}'".into(),
        ];
        let out = format_multiline_curl(&parts);
        assert!(out.contains('\n'), "expected multiline output");
        assert!(out.starts_with("curl -X POST 'https://api.example.com/v1/resources/items' \\"));
        assert!(out.contains("\n  -H "));
        assert!(out.ends_with("{\"a\":1}}'"));
    }
}

fn escape_single_quotes(s: &str) -> String {
    s.replace('\'', "'\\''")
}
