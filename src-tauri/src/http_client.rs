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
        raw,
        duration_ms: duration,
    })
}
