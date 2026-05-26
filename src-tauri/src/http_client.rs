use base64::{engine::general_purpose::STANDARD, Engine};
use encoding_rs::Encoding;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Instant;

static HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

fn shared_client() -> Result<&'static reqwest::Client, String> {
    HTTP_CLIENT
        .get_or_init(|| {
            let builder = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::limited(10));
            let builder = crate::proxy_config::prepare_http_client_builder(builder)?;
            builder.build().map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(|e| e.clone())
}

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
pub struct SendRequest {
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

#[derive(Serialize)]
pub struct SendResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    /// Full outbound HTTP/1-style request (request line + headers + body).
    #[serde(rename = "request_raw")]
    pub request_raw: String,
    /// Full inbound HTTP response (status line + headers + body).
    pub raw: String,
    pub duration_ms: u64,
}

fn version_string(version: reqwest::Version) -> &'static str {
    match version {
        reqwest::Version::HTTP_09 => "HTTP/0.9",
        reqwest::Version::HTTP_10 => "HTTP/1.0",
        reqwest::Version::HTTP_11 => "HTTP/1.1",
        reqwest::Version::HTTP_2 => "HTTP/2",
        reqwest::Version::HTTP_3 => "HTTP/3",
        _ => "HTTP/1.1",
    }
}

fn header_exists(headers: &[(String, String)], name: &str) -> bool {
    headers
        .iter()
        .any(|(k, _)| k.eq_ignore_ascii_case(name))
}

fn request_target(url: &::url::Url) -> String {
    let path = url.path();
    if path.is_empty() {
        return match url.query() {
            Some(q) => format!("/?{}", q),
            None => "/".to_string(),
        };
    }
    match url.query() {
        Some(q) => format!("{}?{}", path, q),
        None => path.to_string(),
    }
}

fn host_header_value(url: &::url::Url) -> String {
    let host = url.host_str().unwrap_or("");
    match (url.scheme(), url.port()) {
        ("http", Some(80)) | ("https", Some(443)) => host.to_string(),
        (_, Some(port)) => format!("{}:{}", host, port),
        _ => host.to_string(),
    }
}

fn content_type_for_body_type(body_type: &str) -> Option<&'static str> {
    match body_type {
        "json" => Some("application/json"),
        "xml" => Some("application/xml"),
        "html" => Some("text/html"),
        "text" => Some("text/plain"),
        "javascript" => Some("application/javascript"),
        "x-www-form-urlencoded" => Some("application/x-www-form-urlencoded"),
        "form-data" => Some("multipart/form-data"),
        "binary" => Some("application/octet-stream"),
        _ => None,
    }
}

fn read_file_bytes(path: &str) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

fn decode_base64(data: &str) -> Result<Vec<u8>, String> {
    STANDARD
        .decode(data)
        .map_err(|e| format!("Invalid base64 body: {}", e))
}

fn header_lookup<'a>(headers: &'a HashMap<String, String>, name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case(name))
        .map(|(_, v)| v.as_str())
}

fn charset_from_content_type(content_type: &str) -> Option<String> {
    for part in content_type.split(';').skip(1) {
        let part = part.trim();
        let (key, value) = part.split_once('=')?;
        if !key.trim().eq_ignore_ascii_case("charset") {
            continue;
        }
        let value = value.trim().trim_matches(|c| c == '"' || c == '\'').trim();
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }
    None
}

fn strip_utf8_bom(bytes: &[u8]) -> &[u8] {
    bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes)
}

/// Decode response bytes using `Content-Type` charset (defaults to UTF-8).
fn decode_http_body(bytes: &[u8], headers: &HashMap<String, String>) -> Result<String, String> {
    let bytes = strip_utf8_bom(bytes);
    let charset = header_lookup(headers, "content-type")
        .and_then(charset_from_content_type)
        .unwrap_or_else(|| "utf-8".to_string());

    if charset.eq_ignore_ascii_case("utf-8") || charset.eq_ignore_ascii_case("utf8") {
        return std::str::from_utf8(bytes)
            .map(|s| s.to_string())
            .map_err(|e| format!("Invalid UTF-8 response body: {e}"));
    }

    let encoding = Encoding::for_label(charset.as_bytes()).ok_or_else(|| {
        format!(
            "Unsupported response charset \"{charset}\" (from Content-Type)"
        )
    })?;
    let (decoded, _, _) = encoding.decode(bytes);
    Ok(decoded.into_owned())
}

fn load_file_part(field: &FormFieldPart) -> Result<(Vec<u8>, String), String> {
    if let Some(path) = &field.file_path {
        let bytes = read_file_bytes(path)?;
        let name = field
            .file_name
            .clone()
            .or_else(|| {
                std::path::Path::new(path)
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
            })
            .unwrap_or_else(|| "file".to_string());
        return Ok((bytes, name));
    }
    if let Some(b64) = &field.file_data_base64 {
        let bytes = decode_base64(b64)?;
        let name = field.file_name.clone().unwrap_or_else(|| "file".to_string());
        return Ok((bytes, name));
    }
    Err("Form file field has no file path or data".to_string())
}

fn build_multipart_form(fields: &[FormFieldPart]) -> Result<reqwest::multipart::Form, String> {
    let mut form = reqwest::multipart::Form::new();
    for field in fields {
        if field.key.is_empty() {
            continue;
        }
        if field.file_path.is_some() || field.file_data_base64.is_some() {
            let (bytes, name) = load_file_part(field)?;
            let part = reqwest::multipart::Part::bytes(bytes)
                .file_name(name)
                .mime_str("application/octet-stream")
                .map_err(|e| e.to_string())?;
            form = form.part(field.key.clone(), part);
        } else if let Some(value) = &field.value {
            form = form.text(field.key.clone(), value.clone());
        }
    }
    Ok(form)
}

fn load_binary_body(req: &SendRequest) -> Result<(Vec<u8>, String), String> {
    if let Some(path) = &req.binary_file_path {
        let bytes = read_file_bytes(path)?;
        let name = req
            .binary_file_name
            .clone()
            .or_else(|| {
                std::path::Path::new(path)
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
            })
            .unwrap_or_else(|| "file".to_string());
        return Ok((bytes, name));
    }
    if let Some(b64) = &req.binary_data_base64 {
        let bytes = decode_base64(b64)?;
        let name = req
            .binary_file_name
            .clone()
            .unwrap_or_else(|| "file".to_string());
        return Ok((bytes, name));
    }
    Err("Binary body requires a file path or base64 data".to_string())
}

/// Reconstruct the outbound HTTP message (HTTP/1.1-style) including implicit headers.
fn format_raw_request(
    method: &str,
    request_url: &str,
    headers: &HashMap<String, String>,
    body_type: &str,
    body: Option<&str>,
    form_fields: &[FormFieldPart],
    binary_name: Option<&str>,
) -> String {
    let parsed: ::url::Url = match ::url::Url::parse(request_url) {
        Ok(u) => u,
        Err(_) => {
            let mut raw = format!("{} {} HTTP/1.1\r\n", method, request_url);
            for (name, value) in headers {
                raw.push_str(&format!("{}: {}\r\n", name, value));
            }
            raw.push_str("\r\n");
            if let Some(b) = body {
                if !b.is_empty() && body_type != "none" {
                    raw.push_str(b);
                }
            }
            return raw;
        }
    };

    let path_query = request_target(&parsed);

    let mut header_lines: Vec<(String, String)> = Vec::new();
    header_lines.push(("Host".to_string(), host_header_value(&parsed)));

    for (key, value) in headers {
        if key.eq_ignore_ascii_case("host") {
            continue;
        }
        header_lines.push((key.clone(), value.clone()));
    }

    let body_str = body.filter(|b| !b.is_empty() && body_type != "none");
    let has_structured_body = body_type == "form-data" && !form_fields.is_empty()
        || body_type == "binary" && binary_name.is_some();

    if body_str.is_some() || has_structured_body {
        if !header_exists(&header_lines, "content-type") {
            if let Some(ct) = content_type_for_body_type(body_type) {
                header_lines.push(("Content-Type".to_string(), ct.to_string()));
            }
        }
        if let Some(b) = body_str {
            if !header_exists(&header_lines, "content-length") {
                header_lines.push(("Content-Length".to_string(), b.len().to_string()));
            }
        } else if has_structured_body {
            header_lines.push((
                "Content-Length".to_string(),
                "(multipart body)".to_string(),
            ));
        }
    }

    let mut raw = format!("{} {} HTTP/1.1\r\n", method, &path_query);
    for (name, value) in &header_lines {
        raw.push_str(&format!("{}: {}\r\n", name, value));
    }
    raw.push_str("\r\n");
    if let Some(b) = body_str {
        raw.push_str(b);
    } else if body_type == "form-data" {
        for field in form_fields {
            if field.key.is_empty() {
                continue;
            }
            if field.file_path.is_some() || field.file_data_base64.is_some() {
                let name = field.file_name.as_deref().unwrap_or("file");
                raw.push_str(&format!("[file] {}={}\n", field.key, name));
            } else if let Some(v) = &field.value {
                raw.push_str(&format!("{}={}\n", field.key, v));
            }
        }
    } else if let Some(name) = binary_name {
        raw.push_str(&format!("[binary file: {}]\n", name));
    }
    raw
}

fn format_raw_http(
    version: reqwest::Version,
    status: u16,
    status_text: &str,
    headers: &HashMap<String, String>,
    body: &str,
) -> String {
    let version_str = version_string(version);
    let status_line = if status_text.is_empty() {
        format!("{} {}\r\n", version_str, status)
    } else {
        format!("{} {} {}\r\n", version_str, status, status_text)
    };

    let mut raw = status_line;
    for (name, value) in headers {
        raw.push_str(&format!("{}: {}\r\n", name, value));
    }
    raw.push_str("\r\n");
    raw.push_str(body);
    raw
}

pub async fn send(req: SendRequest) -> Result<SendResponse, String> {
    let client = shared_client()?;

    let binary_name = req.binary_file_name.as_deref();
    let request_raw = format_raw_request(
        &req.method,
        &req.url,
        &req.headers,
        &req.body_type,
        req.body.as_deref(),
        &req.form_fields,
        binary_name,
    );

    let method = reqwest::Method::from_bytes(req.method.as_bytes())
        .map_err(|e| format!("Invalid HTTP method: {}", e))?;

    let mut builder = client.request(method, &req.url);

    for (key, value) in &req.headers {
        builder = builder.header(key, value);
    }

    if let Some(body) = &req.body {
        if !body.is_empty() && req.body_type != "none" {
            match req.body_type.as_str() {
                "json" => {
                    builder = builder
                        .header("Content-Type", "application/json")
                        .body(body.clone());
                }
                "xml" => {
                    builder = builder
                        .header("Content-Type", "application/xml")
                        .body(body.clone());
                }
                "html" => {
                    builder = builder
                        .header("Content-Type", "text/html")
                        .body(body.clone());
                }
                "text" => {
                    builder = builder
                        .header("Content-Type", "text/plain")
                        .body(body.clone());
                }
                "javascript" => {
                    builder = builder
                        .header("Content-Type", "application/javascript")
                        .body(body.clone());
                }
                "raw" => {
                    builder = builder.body(body.clone());
                }
                "x-www-form-urlencoded" => {
                    builder = builder
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .body(body.clone());
                }
                _ => {
                    builder = builder.body(body.clone());
                }
            }
        }
    } else {
        match req.body_type.as_str() {
            "form-data" if !req.form_fields.is_empty() => {
                let form = build_multipart_form(&req.form_fields)?;
                builder = builder.multipart(form);
            }
            "binary" => {
                let (bytes, _name) = load_binary_body(&req)?;
                builder = builder
                    .header("Content-Type", "application/octet-stream")
                    .body(bytes);
            }
            _ => {}
        }
    }

    let start = Instant::now();
    let resp = builder.send().await.map_err(|e| e.to_string())?;
    let duration = start.elapsed().as_millis() as u64;

    let status = resp.status().as_u16();
    let status_text = resp.status().canonical_reason().unwrap_or("").to_string();
    let http_version = resp.version();

    let mut resp_headers = HashMap::new();
    for (name, value) in resp.headers() {
        resp_headers.insert(
            name.to_string(),
            String::from_utf8_lossy(value.as_bytes()).to_string(),
        );
    }

    let body_bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    let body = decode_http_body(&body_bytes, &resp_headers)?;
    let raw = format_raw_http(http_version, status, &status_text, &resp_headers, &body);

    Ok(SendResponse {
        status,
        status_text,
        headers: resp_headers,
        body,
        request_raw,
        raw,
        duration_ms: duration,
    })
}
