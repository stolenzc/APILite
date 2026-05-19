//! Bridge gaps between OS proxy settings and reqwest's built-in `system-proxy` support.
//!
//! On macOS, hyper-util only reads HTTP/HTTPS proxy host/port. It does not apply the system
//! "Bypass proxy settings for these Hosts & Domains" list, so requests to LAN IPs may be sent
//! through the proxy while Postman/browsers connect directly. SOCKS-only setups are also missed.

#[cfg(target_os = "macos")]
pub fn prepare_http_client_builder(
    builder: reqwest::ClientBuilder,
) -> Result<reqwest::ClientBuilder, String> {
    use reqwest::Proxy;

    apply_no_proxy_from_system_exceptions();

    let settings = match read_system_proxy_settings() {
        Some(s) => s,
        None => return Ok(builder),
    };

    // When only SOCKS is enabled (common for some local proxy apps), reqwest would otherwise
    // not use any proxy.
    if settings.socks_enabled && !settings.http_enabled && !settings.https_enabled {
        let url = format!(
            "socks5://{}:{}",
            settings.socks_host, settings.socks_port
        );
        return Ok(builder.proxy(Proxy::all(&url).map_err(|e| e.to_string())?));
    }

    Ok(builder)
}

#[cfg(not(target_os = "macos"))]
pub fn prepare_http_client_builder(
    builder: reqwest::ClientBuilder,
) -> Result<reqwest::ClientBuilder, String> {
    Ok(builder)
}

#[cfg(target_os = "macos")]
fn apply_no_proxy_from_system_exceptions() {
    if std::env::var_os("NO_PROXY").is_some() || std::env::var_os("no_proxy").is_some() {
        return;
    }
    let Some(list) = read_system_proxy_settings().and_then(|s| s.exceptions) else {
        return;
    };
    if list.is_empty() {
        return;
    }
    // reqwest/hyper-util read NO_PROXY when building the system proxy matcher.
    std::env::set_var("NO_PROXY", list);
}

#[cfg(target_os = "macos")]
struct SystemProxySettings {
    http_enabled: bool,
    https_enabled: bool,
    socks_enabled: bool,
    socks_host: String,
    socks_port: u16,
    exceptions: Option<String>,
}

#[cfg(target_os = "macos")]
fn read_system_proxy_settings() -> Option<SystemProxySettings> {
    use std::os::raw::c_void;

    use system_configuration::core_foundation::array::CFArray;
    use system_configuration::core_foundation::base::TCFType;
    use system_configuration::core_foundation::number::CFNumber;
    use system_configuration::core_foundation::string::{CFString, CFStringRef};
    use system_configuration::dynamic_store::SCDynamicStoreBuilder;
    use system_configuration::sys::schema_definitions::{
        kSCPropNetProxiesExceptionsList, kSCPropNetProxiesHTTPEnable,
        kSCPropNetProxiesHTTPSEnable, kSCPropNetProxiesSOCKSEnable,
        kSCPropNetProxiesSOCKSPort, kSCPropNetProxiesSOCKSProxy,
    };

    let store = SCDynamicStoreBuilder::new("APILite").build()?;
    let proxies = store.get_proxies()?;

    let enabled = |key: CFStringRef| -> bool {
        proxies
            .find(key)
            .and_then(|v| v.downcast::<CFNumber>())
            .and_then(|n| n.to_i32())
            .unwrap_or(0)
            == 1
    };

    let socks_port = proxies
        .find(unsafe { kSCPropNetProxiesSOCKSPort })
        .and_then(|v| v.downcast::<CFNumber>())
        .and_then(|n| n.to_i32())
        .unwrap_or(1080) as u16;

    let socks_host = proxies
        .find(unsafe { kSCPropNetProxiesSOCKSProxy })
        .and_then(|v| v.downcast::<CFString>())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let exceptions = proxies
        .find(unsafe { kSCPropNetProxiesExceptionsList })
        .and_then(|v| v.downcast::<CFArray>())
        .map(|arr| {
            let mut parts = Vec::new();
            for item in arr.iter() {
                let host = unsafe {
                    CFString::wrap_under_get_rule(*item as *const c_void as CFStringRef).to_string()
                };
                if !host.is_empty() {
                    parts.push(host);
                }
            }
            if parts.is_empty() {
                None
            } else {
                Some(parts.join(","))
            }
        })
        .flatten();

    Some(SystemProxySettings {
        http_enabled: enabled(unsafe { kSCPropNetProxiesHTTPEnable }),
        https_enabled: enabled(unsafe { kSCPropNetProxiesHTTPSEnable }),
        socks_enabled: enabled(unsafe { kSCPropNetProxiesSOCKSEnable }),
        socks_host,
        socks_port,
        exceptions,
    })
}
