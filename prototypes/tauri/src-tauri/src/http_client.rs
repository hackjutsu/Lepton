use reqwest::{Client, NoProxy, Proxy, Url};
use std::time::Duration;

fn normalize_proxy(input: &str) -> Result<String, String> {
    let input = input.trim();
    if input.is_empty() || input.starts_with("pac+") || input.contains([';', ',', '=']) {
        return Err("Unsupported proxy configuration".into());
    }
    let normalized = input
        .strip_prefix("socks://")
        .map(|tail| format!("socks5://{tail}"))
        .unwrap_or_else(|| input.to_owned());
    let url = Url::parse(&normalized).map_err(|_| "Invalid proxy address")?;
    if !matches!(
        url.scheme(),
        "http" | "https" | "socks4" | "socks4a" | "socks5" | "socks5h"
    ) || url.host_str().is_none()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "" | "/")
    {
        return Err("Invalid proxy address".into());
    }
    Ok(normalized)
}

pub fn provider_client(proxy: Option<&str>) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("lepton-snippet-app");
    if let Some(address) = proxy {
        let normalized = normalize_proxy(address)?;
        let proxy = Proxy::all(&normalized)
            .map_err(|_| "Invalid proxy address")?
            .no_proxy(NoProxy::from_string("localhost,127.0.0.0/8,::1"));
        builder = builder.proxy(proxy);
    }
    builder
        .build()
        .map_err(|_| "Unable to initialize provider network".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn supports_common_proxy_urls_and_refuses_unsupported_rules() {
        assert_eq!(
            normalize_proxy(" socks://localhost:1080 ").unwrap(),
            "socks5://localhost:1080"
        );
        assert!(provider_client(Some("http://127.0.0.1:8080")).is_ok());
        assert!(provider_client(Some("socks5://127.0.0.1:1080")).is_ok());
        for input in [
            "",
            "pac+https://example.test/config.pac",
            "http=proxy:8080;https=proxy:8080",
            "file:///tmp/proxy",
        ] {
            assert!(provider_client(Some(input)).is_err());
        }
    }
}
