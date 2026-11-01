use reqwest::{Client, Proxy, Url};
use std::net::IpAddr;
use std::time::Duration;

fn normalize_proxy(input: &str, default_scheme: &str) -> Result<Url, String> {
    let input = input.trim();
    if input.is_empty() || input.starts_with("pac+") || input.contains([';', ',', '=']) {
        return Err("Unsupported proxy configuration".into());
    }
    let normalized = input
        .strip_prefix("socks://")
        .map(|tail| format!("socks5://{tail}"))
        .unwrap_or_else(|| {
            if input.contains("://") {
                input.to_owned()
            } else {
                format!("{default_scheme}://{input}")
            }
        });
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
    Ok(url)
}

#[derive(Default)]
struct ProxyRules {
    all: Option<Url>,
    http: Option<Url>,
    https: Option<Url>,
    fallback: Option<Url>,
}
impl ProxyRules {
    fn parse(input: &str) -> Result<Self, String> {
        let input = input.trim();
        if input.starts_with("pac+") || input.contains(',') {
            return Err("Unsupported proxy configuration".into());
        }
        if !input.contains('=') {
            return Ok(Self {
                all: Some(normalize_proxy(input, "http")?),
                ..Self::default()
            });
        }
        let mut rules = Self::default();
        for rule in input.split(';').filter(|entry| !entry.trim().is_empty()) {
            let (scheme, address) = rule.split_once('=').ok_or("Invalid proxy rules")?;
            let slot = match scheme.trim() {
                "http" => &mut rules.http,
                "https" => &mut rules.https,
                "socks" => &mut rules.fallback,
                _ => return Err("Unsupported proxy rule".into()),
            };
            if slot.is_some() {
                return Err("Duplicate proxy rule".into());
            }
            *slot = Some(normalize_proxy(
                address,
                if scheme.trim() == "socks" {
                    "socks4"
                } else {
                    "http"
                },
            )?);
        }
        Ok(rules)
    }
    fn select(&self, target: &Url) -> Option<Url> {
        let host = target.host_str()?;
        let bare = host.trim_matches(['[', ']']);
        if bare.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
            || (!bare.contains('.') && !bare.contains(':'))
        {
            return None;
        }
        self.all
            .as_ref()
            .or(match target.scheme() {
                "http" => self.http.as_ref(),
                "https" => self.https.as_ref(),
                _ => None,
            })
            .or(self.fallback.as_ref())
            .cloned()
    }
}

pub fn provider_client(proxy: Option<&str>) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("lepton-snippet-app");
    if let Some(address) = proxy {
        let rules = ProxyRules::parse(address)?;
        builder = builder.proxy(Proxy::custom(move |target| rules.select(target)));
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
            normalize_proxy(" socks://localhost:1080 ", "http")
                .unwrap()
                .as_str(),
            "socks5://localhost:1080"
        );
        assert!(provider_client(Some("http://127.0.0.1:8080")).is_ok());
        assert!(provider_client(Some("socks5://127.0.0.1:1080")).is_ok());
        for input in [
            "",
            "pac+https://example.test/config.pac",
            "file:///tmp/proxy",
        ] {
            assert!(provider_client(Some(input)).is_err());
        }
    }
    #[test]
    fn selects_scheme_specific_and_fallback_proxies_and_bypasses_local_hosts() {
        let rules = ProxyRules::parse(
            "http=proxy-one:8080;https=https://proxy-two:8443;socks=proxy-three:1080",
        )
        .unwrap();
        let select = |target| {
            rules
                .select(&Url::parse(target).unwrap())
                .map(|url| url.to_string())
        };
        assert_eq!(
            select("http://example.com/"),
            Some("http://proxy-one:8080/".into())
        );
        assert_eq!(
            select("https://example.com/"),
            Some("https://proxy-two:8443/".into())
        );
        assert_eq!(
            select("ftp://example.com/"),
            Some("socks4://proxy-three:1080".into())
        );
        for local in [
            "http://localhost/",
            "http://intranet/",
            "http://127.2.3.4/",
            "http://[::1]/",
        ] {
            assert_eq!(select(local), None);
        }
        assert!(ProxyRules::parse("http=one;http=two").is_err());
        assert!(ProxyRules::parse("http=one,direct://").is_err());
    }
}
