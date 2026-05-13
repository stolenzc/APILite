use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCurl {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

pub fn parse_curl(command: &str) -> Result<ParsedCurl, String> {
    let trimmed = command.trim();
    if !trimmed.starts_with("curl ") && !trimmed.starts_with("curl\t") {
        return Err("Command must start with 'curl'".into());
    }

    let tokens = tokenize(trimmed)?;
    let mut method = String::new();
    let mut url = String::new();
    let mut headers: Vec<(String, String)> = Vec::new();
    let mut body: Option<String> = None;
    let mut data_body: Vec<String> = Vec::new();

    let mut i = 0;
    while i < tokens.len() {
        match tokens[i].as_str() {
            "-X" | "--request" => {
                i += 1;
                if i < tokens.len() {
                    method = tokens[i].clone();
                }
            }
            "-H" | "--header" => {
                i += 1;
                if i < tokens.len() {
                    if let Some((k, v)) = parse_header(&tokens[i]) {
                        headers.push((k, v));
                    }
                }
            }
            "-d" | "--data" | "--data-raw" | "--data-binary" => {
                i += 1;
                if i < tokens.len() {
                    data_body.push(tokens[i].clone());
                }
            }
            "--data-urlencode" => {
                i += 1;
                if i < tokens.len() {
                    // Decode URL-encoded data
                    let decoded = urldecode(&tokens[i]);
                    data_body.push(decoded);
                }
            }
            _ => {
                // If it looks like a URL (starts with http:// or https:// or starts with ')
                let t = &tokens[i];
                if (t.starts_with("http://") || t.starts_with("https://") || t.starts_with('"') || t.starts_with('\'')) && url.is_empty() {
                    url = strip_quotes(t);
                }
            }
        }
        i += 1;
    }

    if url.is_empty() {
        return Err("No URL found in curl command".into());
    }

    // Combine data parts with &
    if !data_body.is_empty() {
        body = Some(data_body.join("&"));
    }

    // Default method
    if method.is_empty() {
        method = if body.is_some() { "POST".into() } else { "GET".into() };
    }

    Ok(ParsedCurl { method, url, headers, body })
}

fn tokenize(command: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    // Skip "curl " prefix
    let after_curl = command.trim_start().strip_prefix("curl").ok_or("Invalid curl command")?;
    let after_curl = after_curl.trim_start();

    let mut ci = after_curl.chars().peekable();

    while let Some(c) = ci.next() {
        if c == '\'' && !in_double_quote {
            in_single_quote = !in_single_quote;
            continue;
        }
        if c == '"' && !in_single_quote {
            in_double_quote = !in_double_quote;
            continue;
        }
        if c.is_whitespace() && !in_single_quote && !in_double_quote {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(c);
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    if in_single_quote || in_double_quote {
        return Err("Unclosed quote in curl command".into());
    }

    Ok(tokens)
}

fn parse_header(header_str: &str) -> Option<(String, String)> {
    let clean = strip_quotes(header_str);
    if let Some(pos) = clean.find(':') {
        let key = clean[..pos].trim().to_string();
        let value = clean[pos + 1..].trim().to_string();
        Some((key, value))
    } else {
        None
    }
}

fn strip_quotes(s: &str) -> String {
    let s = s.trim();
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        return s[1..s.len() - 1].to_string();
    }
    s.to_string()
}

fn urldecode(s: &str) -> String {
    url::form_urlencoded::parse(s.as_bytes())
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&")
}
