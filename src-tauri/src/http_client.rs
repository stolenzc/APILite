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

#[derive(Deserialize)]
pub struct SendRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    #[serde(rename = "bodyType")]
    pub body_type: String,
    pub body: Option<String>,
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
        _ => None,
    }
}

/// Reconstruct the outbound HTTP message (HTTP/1.1-style) including implicit headers.
fn format_raw_request(
    method: &str,
    request_url: &str,
    headers: &HashMap<String, String>,
    body_type: &str,
    body: Option<&str>,
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
    if let Some(b) = body_str {
        if !header_exists(&header_lines, "content-type") {
            if let Some(ct) = content_type_for_body_type(body_type) {
                header_lines.push(("Content-Type".to_string(), ct.to_string()));
            }
        }
        if !header_exists(&header_lines, "content-length") {
            header_lines.push(("Content-Length".to_string(), b.len().to_string()));
        }
    }

    let mut raw = format!("{} {} HTTP/1.1\r\n", method, &path_query);
    for (name, value) in &header_lines {
        raw.push_str(&format!("{}: {}\r\n", name, value));
    }
    raw.push_str("\r\n");
    if let Some(b) = body_str {
        raw.push_str(b);
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

    let method = reqwest::Method::from_bytes(req.method.as_bytes())
        .map_err(|e| format!("Invalid HTTP method: {}", e))?;

    let request_raw = format_raw_request(
        &req.method,
        &req.url,
        &req.headers,
        &req.body_type,
        req.body.as_deref(),
    );

    let mut builder = client.request(method, &req.url);

    // Add headers
    for (key, value) in &req.headers {
        builder = builder.header(key, value);
    }

    // Add body
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
                "form-data" => {
                    let mut form = reqwest::multipart::Form::new();
                    for part in body.split('&') {
                        if let Some((k, v)) = part.split_once('=') {
                            form = form.text(k.to_string(), v.to_string());
                        }
                    }
                    builder = builder.multipart(form);
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

    let body = resp.text().await.map_err(|e| e.to_string())?;
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
