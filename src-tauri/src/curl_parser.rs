use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCurl {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

pub fn parse_curl(command: &str) -> Result<ParsedCurl, String> {
    let normalized = normalize_line_continuations(command);
    let unescaped = unescape_cmd_carets(&normalized);
    let trimmed = unescaped.trim();
    if trimmed.is_empty() {
        return Err("Empty command".into());
    }

    if is_powershell_invoke(trimmed) {
        return parse_powershell_invoke(trimmed);
    }

    let curl_cmd = normalize_curl_prefix(trimmed);
    parse_curl_inner(&curl_cmd)
}

fn is_powershell_invoke(s: &str) -> bool {
    let lower = s.to_lowercase();
    lower.contains("invoke-webrequest")
        || lower.contains("invoke-restmethod")
        || lower.contains(" iwr ")
        || lower.starts_with("iwr ")
        || lower.contains(" irm ")
        || lower.starts_with("irm ")
}

fn normalize_curl_prefix(s: &str) -> String {
    let t = s.trim();
    let bytes = t.as_bytes();
    if bytes.len() >= 8
        && bytes[0..4].eq_ignore_ascii_case(b"curl")
        && bytes[4..8].eq_ignore_ascii_case(b".exe")
    {
        let rest = &t[8..];
        if rest.is_empty() || rest.chars().next().is_some_and(|c| c.is_whitespace()) {
            return format!("curl{rest}");
        }
    }
    t.to_string()
}

fn parse_powershell_invoke(command: &str) -> Result<ParsedCurl, String> {
    let segment = extract_invoke_segment(command).ok_or("No Invoke-WebRequest command found")?;
    let segment = truncate_at_pipeline(segment);

    let mut url = extract_ps_parameter(segment, &["-Uri", "-uri"])
        .ok_or("No -Uri found in PowerShell command")?;
    url = strip_quotes(&url);

    let mut method = extract_ps_parameter(segment, &["-Method", "-method"]).unwrap_or_default();
    method = strip_quotes(&method);

    let mut headers = extract_ps_headers(segment);
    if let Some(ct) = extract_ps_parameter(segment, &["-ContentType", "-contentType", "-contenttype"]) {
        let ct = strip_quotes(&ct);
        if !headers.iter().any(|(k, _)| k.eq_ignore_ascii_case("content-type")) {
            headers.push(("Content-Type".to_string(), ct));
        }
    }

    let body = extract_ps_parameter(segment, &["-Body", "-body"]).map(|b| strip_quotes(&b));

    if method.is_empty() {
        method = if body.is_some() { "POST".into() } else { "GET".into() };
    }

    Ok(ParsedCurl {
        method: method.to_uppercase(),
        url,
        headers,
        body,
    })
}

fn extract_invoke_segment(command: &str) -> Option<&str> {
    let lower = command.to_lowercase();
    let mut best: Option<usize> = None;
    for needle in [
        "invoke-webrequest",
        "invoke-restmethod",
        "iwr ",
        "irm ",
    ] {
        if let Some(i) = lower.find(needle) {
            best = Some(best.map(|b| b.min(i)).unwrap_or(i));
        }
    }
    best.map(|i| &command[i..])
}

fn truncate_at_pipeline(s: &str) -> &str {
    let mut in_single = false;
    let mut in_double = false;
    let mut brace_depth: i32 = 0;
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '\'' && !in_double {
            in_single = !in_single;
            i += 1;
            continue;
        }
        if c == '"' && !in_single {
            in_double = !in_double;
            i += 1;
            continue;
        }
        if !in_single && !in_double {
            if c == '@' && chars.get(i + 1) == Some(&'{') {
                brace_depth += 1;
                i += 2;
                continue;
            }
            if c == '{' {
                brace_depth += 1;
            } else if c == '}' {
                brace_depth -= 1;
            } else if c == '|' && brace_depth == 0 {
                let before_ws = i > 0 && chars[i - 1].is_whitespace();
                let after_ws = chars.get(i + 1).map(|c| c.is_whitespace()).unwrap_or(false);
                if before_ws || after_ws {
                    return s[..i].trim_end();
                }
            }
        }
        i += 1;
    }
    s
}

fn find_flag_position(cmd_lower: &str, flag: &str) -> Option<usize> {
    let mut search_from = 0;
    while let Some(rel) = cmd_lower[search_from..].find(flag) {
        let abs = search_from + rel;
        let before_ok = abs == 0 || cmd_lower.as_bytes()[abs - 1].is_ascii_whitespace();
        let after = abs + flag.len();
        let after_ok =
            after >= cmd_lower.len() || cmd_lower.as_bytes()[after].is_ascii_whitespace();
        if before_ok && after_ok {
            return Some(abs);
        }
        search_from = abs + 1;
    }
    None
}

fn extract_ps_parameter(cmd: &str, names: &[&str]) -> Option<String> {
    let cmd_lower = cmd.to_lowercase();
    for name in names {
        let flag = name.to_lowercase();
        if let Some(pos) = find_flag_position(&cmd_lower, &flag) {
            let rest = cmd[pos + flag.len()..].trim_start();
            if let Some(value) = read_ps_value(rest) {
                return Some(value);
            }
        }
    }
    None
}

fn read_ps_value(rest: &str) -> Option<String> {
    let rest = rest.trim_start();
    if rest.is_empty() {
        return None;
    }
    if rest.starts_with('"') {
        return read_quoted_double(rest);
    }
    if rest.starts_with('\'') {
        return read_quoted_single(rest);
    }
    if rest.starts_with("@{") || rest.starts_with('$') {
        return None;
    }
    let end = rest
        .find(|c: char| c.is_whitespace())
        .unwrap_or(rest.len());
    Some(rest[..end].to_string())
}

fn read_quoted_double(s: &str) -> Option<String> {
    let mut out = String::new();
    let mut chars = s.chars();
    chars.next(); // opening "
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(next) = chars.next() {
                out.push(next);
            }
            continue;
        }
        if c == '`' {
            if let Some(next) = chars.next() {
                out.push(next);
            }
            continue;
        }
        if c == '"' {
            return Some(out);
        }
        out.push(c);
    }
    None
}

fn read_quoted_single(s: &str) -> Option<String> {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    chars.next();
    while let Some(c) = chars.next() {
        if c == '\'' {
            if chars.peek() == Some(&'\'') {
                chars.next();
                out.push('\'');
                continue;
            }
            return Some(out);
        }
        out.push(c);
    }
    None
}

fn extract_ps_headers(cmd: &str) -> Vec<(String, String)> {
    let cmd_lower = cmd.to_lowercase();
    let flag = "-headers";
    let Some(pos) = find_flag_position(&cmd_lower, flag) else {
        return Vec::new();
    };
    let rest = cmd[pos + flag.len()..].trim_start();
    if !rest.starts_with("@{") {
        return Vec::new();
    }
    let Some(inner) = extract_hashtable_inner(rest) else {
        return Vec::new();
    };
    parse_hashtable_pairs(&inner)
}

fn extract_hashtable_inner(s: &str) -> Option<String> {
    let s = s.trim_start();
    if !s.starts_with("@{") {
        return None;
    }
    let mut depth = 0i32;
    let mut end_idx = None;
    for (i, c) in s.char_indices() {
        match c {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end_idx = Some(i);
                    break;
                }
            }
            _ => {}
        }
    }
    let end = end_idx?;
    let inner = s[2..end].trim();
    Some(inner.to_string())
}

fn parse_hashtable_pairs(inner: &str) -> Vec<(String, String)> {
    let mut headers = Vec::new();
    let mut rest = inner;
    while !rest.trim().is_empty() {
        let Some((key, value, consumed)) = read_hashtable_entry(rest) else {
            break;
        };
        headers.push((strip_quotes(&key), strip_quotes(&value)));
        rest = &rest[consumed..];
    }
    headers
}

fn read_hashtable_entry(s: &str) -> Option<(String, String, usize)> {
    let s = s.trim_start();
    if s.is_empty() {
        return None;
    }
    let (key, key_len) = read_hashtable_key(s)?;
    let after_key = s[key_len..].trim_start();
    if !after_key.starts_with('=') {
        return None;
    }
    let value_start = key_len + (s[key_len..].len() - after_key.len()) + 1;
    let after_eq = after_key[1..].trim_start();
    let value_offset = value_start + (after_key[1..].len() - after_eq.len());
    let (value, value_len) = read_hashtable_value(after_eq)?;
    let consumed = value_offset + value_len;
    Some((key, value, consumed))
}

fn read_hashtable_key(s: &str) -> Option<(String, usize)> {
    if s.starts_with('"') {
        return read_quoted_with_len(s, '"');
    }
    if s.starts_with('\'') {
        return read_quoted_with_len(s, '\'');
    }
    let end = s.find('=')?;
    let key = s[..end].trim().to_string();
    Some((key, end))
}

fn read_hashtable_value(s: &str) -> Option<(String, usize)> {
    if s.starts_with('"') {
        return read_quoted_with_len(s, '"');
    }
    if s.starts_with('\'') {
        return read_quoted_with_len(s, '\'');
    }
    let end = s
        .find(|c: char| c.is_whitespace() || c == ';')
        .unwrap_or(s.len());
    Some((s[..end].to_string(), end))
}

fn read_quoted_with_len(s: &str, quote: char) -> Option<(String, usize)> {
    let content = if quote == '"' {
        read_quoted_double(s)?
    } else {
        read_quoted_single(s)?
    };
    let end = quoted_byte_end(s, quote)?;
    Some((content, end))
}

fn quoted_byte_end(s: &str, quote: char) -> Option<usize> {
    if !s.starts_with(quote) {
        return None;
    }
    let mut chars = s.char_indices().skip(1);
    while let Some((i, c)) = chars.next() {
        if quote == '"' && (c == '\\' || c == '`') {
            chars.next();
            continue;
        }
        if c == quote {
            if quote == '\'' {
                let next = s[i + c.len_utf8()..].chars().next();
                if next == Some('\'') {
                    continue;
                }
            }
            return Some(i + c.len_utf8());
        }
    }
    None
}

fn parse_curl_inner(command: &str) -> Result<ParsedCurl, String> {
    let trimmed = command.trim();
    if !trimmed.starts_with("curl") {
        return Err("Command must start with 'curl'".into());
    }
    let after_curl = trimmed.strip_prefix("curl").unwrap_or("");
    if !after_curl.is_empty() && !after_curl.starts_with(|c: char| c.is_whitespace()) {
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
                    let decoded = urldecode(&tokens[i]);
                    data_body.push(decoded);
                }
            }
            _ => {
                let t = &tokens[i];
                if (t.starts_with("http://")
                    || t.starts_with("https://")
                    || t.starts_with('"')
                    || t.starts_with('\''))
                    && url.is_empty()
                {
                    url = strip_quotes(t);
                }
            }
        }
        i += 1;
    }

    if url.is_empty() {
        return Err("No URL found in curl command".into());
    }

    if !data_body.is_empty() {
        body = Some(data_body.join("&"));
    }

    if method.is_empty() {
        method = if body.is_some() { "POST".into() } else { "GET".into() };
    }

    Ok(ParsedCurl {
        method: method.to_uppercase(),
        url,
        headers,
        body,
    })
}

/// Join lines continued with trailing `\` (bash), `` ` `` (PowerShell), or `^` (Windows CMD).
fn normalize_line_continuations(command: &str) -> String {
    command
        .lines()
        .map(|line| {
            let trimmed_end = line.trim_end();
            if trimmed_end.ends_with('\\') {
                trimmed_end[..trimmed_end.len() - 1].trim_end()
            } else if trimmed_end.ends_with('`') {
                trimmed_end[..trimmed_end.len() - 1].trim_end()
            } else if trimmed_end.ends_with('^') {
                trimmed_end[..trimmed_end.len() - 1].trim_end()
            } else {
                line.trim()
            }
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Returns true when the text looks like Windows CMD "Copy as cURL" caret escaping.
fn has_cmd_caret_escapes(s: &str) -> bool {
    s.contains("^^")
        || s.contains("^\"")
        || s.contains("^'")
        || s.contains("^\\")
        || s.lines().any(|line| line.trim_end().ends_with('^'))
}

/// Unescape Windows CMD caret (`^`) escapes used by Chrome/Edge "Copy as cURL (cmd)".
fn unescape_cmd_carets(s: &str) -> String {
    if !has_cmd_caret_escapes(s) {
        return s.to_string();
    }
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '^' {
            out.push(c);
            continue;
        }
        let Some(&next) = chars.peek() else {
            continue;
        };
        if next == '\r' {
            chars.next();
            if chars.peek() == Some(&'\n') {
                chars.next();
            }
            continue;
        }
        if next == '\n' {
            chars.next();
            continue;
        }
        if next == '^' {
            chars.next();
            out.push('^');
            continue;
        }
        out.push(chars.next().unwrap());
    }
    out
}

fn tokenize(command: &str) -> Result<Vec<String>, String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let after_curl = command
        .trim_start()
        .strip_prefix("curl")
        .ok_or("Invalid curl command")?;
    let after_curl = after_curl.trim_start();

    let mut ci = after_curl.chars().peekable();

    while let Some(c) = ci.next() {
        if c == '\\' && in_double_quote {
            if let Some(&next) = ci.peek() {
                ci.next();
                current.push(next);
                continue;
            }
        }
        if c == '`' && in_double_quote {
            if let Some(next) = ci.next() {
                current.push(next);
            }
            continue;
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_curl_exe() {
        let cmd = r#"curl.exe -X POST "https://api.example.com" -H "Content-Type: application/json" -d "{\"a\":1}""#;
        let p = parse_curl(cmd).unwrap();
        assert_eq!(p.method, "POST");
        assert_eq!(p.url, "https://api.example.com");
        assert_eq!(p.headers[0].0, "Content-Type");
        assert_eq!(p.body.as_deref(), Some(r#"{"a":1}"#));
    }

    #[test]
    fn parses_backtick_continuation() {
        let cmd = "curl.exe -X GET `\n\"https://api.example.com/items\" `\n-H \"Accept: application/json\"";
        let p = parse_curl(cmd).unwrap();
        assert_eq!(p.method, "GET");
        assert_eq!(p.url, "https://api.example.com/items");
        assert_eq!(p.headers[0].1, "application/json");
    }

    #[test]
    fn parses_invoke_webrequest() {
        let cmd = r#"Invoke-WebRequest -UseBasicParsing -Uri "https://httpbin.org/get" -Method "GET" -Headers @{"Accept"="*/*"; "X-Test"="1"}"#;
        let p = parse_curl(cmd).unwrap();
        assert_eq!(p.method, "GET");
        assert_eq!(p.url, "https://httpbin.org/get");
        assert_eq!(p.headers.len(), 2);
        assert!(p.headers.iter().any(|(k, v)| k == "Accept" && v == "*/*"));
    }

    #[test]
    fn parses_invoke_with_body_and_content_type() {
        let cmd = r#"Invoke-RestMethod -Uri 'https://api.example.com' -Method POST -ContentType 'application/json' -Body '{"x":1}'"#;
        let p = parse_curl(cmd).unwrap();
        assert_eq!(p.method, "POST");
        assert_eq!(p.url, "https://api.example.com");
        assert!(p
            .headers
            .iter()
            .any(|(k, v)| k == "Content-Type" && v == "application/json"));
        assert_eq!(p.body.as_deref(), Some(r#"{"x":1}"#));
    }

    #[test]
    fn parses_curl_cmd_caret_escapes() {
        let cmd = r#"curl ^"https://httpbin.org/post^" ^
  -H ^"Content-Type: application/json^" ^
  -d ^"^{^\^"key^\^":^\^"value^\^"}^""#;
        let p = parse_curl(cmd).unwrap();
        assert_eq!(p.method, "POST");
        assert_eq!(p.url, "https://httpbin.org/post");
        assert_eq!(p.headers[0].1, "application/json");
        assert_eq!(p.body.as_deref(), Some(r#"{"key":"value"}"#));
        assert!(!p.body.as_ref().unwrap().contains('^'));
    }

    #[test]
    fn parses_chrome_style_script() {
        let cmd = r#"$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-WebRequest -UseBasicParsing -Uri "https://example.com/api" `
-Method "POST" `
-Headers @{
"Accept"="application/json"
"Authorization"="Bearer token"
} `
-Body '{"ok":true}' | Select-Object -ExpandProperty Content"#;
        let p = parse_curl(cmd).unwrap();
        assert_eq!(p.method, "POST");
        assert_eq!(p.url, "https://example.com/api");
        assert_eq!(p.body.as_deref(), Some(r#"{"ok":true}"#));
        assert!(p.headers.iter().any(|(k, _)| k == "Authorization"));
    }
}
