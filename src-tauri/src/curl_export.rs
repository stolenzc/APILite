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
            parts.push("--data-binary '<(base64 file data)>'".to_string());
        }
    } else if let Some(body) = &req.body {
        if !body.is_empty() && req.body_type != "none" {
            parts.push(format!("-d '{}'", escape_single_quotes(body)));
        }
    }

    parts.join(" ")
}

fn escape_single_quotes(s: &str) -> String {
    s.replace('\'', "'\\''")
}
