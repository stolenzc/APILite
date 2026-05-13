use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

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
    pub duration_ms: u64,
}

pub async fn send(req: SendRequest) -> Result<SendResponse, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

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

    let mut resp_headers = HashMap::new();
    for (name, value) in resp.headers() {
        resp_headers.insert(
            name.to_string(),
            String::from_utf8_lossy(value.as_bytes()).to_string(),
        );
    }

    let body = resp.text().await.map_err(|e| e.to_string())?;

    Ok(SendResponse {
        status,
        status_text,
        headers: resp_headers,
        body,
        duration_ms: duration,
    })
}
