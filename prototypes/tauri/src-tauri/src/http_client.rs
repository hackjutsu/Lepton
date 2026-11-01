use reqwest::{Client, Method, Proxy, Url};
use serde_json::Value;
use std::net::IpAddr;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

#[derive(Clone, Debug, PartialEq, Eq)]
enum Route {
    System,
    Direct,
    Proxy(Url),
}

fn normalize_proxy(input: &str, default_scheme: &str) -> Result<Url, String> {
    let input = input.trim();
    if input.is_empty() || input.contains([';', ',', '=']) {
        return Err("Invalid proxy address".into());
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

fn parse_routes(input: &str, default_scheme: &str) -> Result<Vec<Route>, String> {
    input
        .split(',')
        .map(|entry| {
            let entry = entry.trim();
            if entry.eq_ignore_ascii_case("direct://") {
                Ok(Route::Direct)
            } else {
                Ok(Route::Proxy(normalize_proxy(entry, default_scheme)?))
            }
        })
        .collect()
}

#[derive(Default)]
struct ProxyRules {
    all: Option<Vec<Route>>,
    http: Option<Vec<Route>>,
    https: Option<Vec<Route>>,
    fallback: Option<Vec<Route>>,
}
impl ProxyRules {
    fn parse(input: &str) -> Result<Self, String> {
        let input = input.trim();
        if !input.contains('=') {
            return Ok(Self {
                all: Some(parse_routes(input, "http")?),
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
            *slot = Some(parse_routes(
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
    fn select(&self, target: &Url) -> Vec<Route> {
        let host = target.host_str().unwrap_or("").trim_matches(['[', ']']);
        if host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
            || (!host.contains('.') && !host.contains(':'))
        {
            return vec![Route::Direct];
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
            .unwrap_or_else(|| vec![Route::Direct])
    }
}

enum ProxyConfig {
    System,
    Fixed(ProxyRules),
    Pac(Url),
}
pub struct ProviderClient {
    proxy: ProxyConfig,
}
pub enum Auth<'a> {
    None,
    Bearer(&'a str),
    PrivateToken(&'a str),
}
#[derive(Debug)]
pub enum RequestError {
    Network,
    Configuration(String),
}
impl RequestError {
    pub fn for_provider(self, provider: &str) -> String {
        match self {
            Self::Network => format!("{provider} network request failed"),
            Self::Configuration(message) => message,
        }
    }
}

pub fn provider_client(proxy: Option<&str>) -> Result<ProviderClient, String> {
    let proxy = match proxy {
        None => ProxyConfig::System,
        Some(value) if value.trim().starts_with("pac+") => {
            let url = Url::parse(&value.trim()[4..]).map_err(|_| "Invalid PAC URL")?;
            if !matches!(url.scheme(), "http" | "https" | "file")
                || url.fragment().is_some()
                || !url.username().is_empty()
                || url.password().is_some()
            {
                return Err("Invalid PAC URL".into());
            }
            ProxyConfig::Pac(url)
        }
        Some(value) => ProxyConfig::Fixed(ProxyRules::parse(value)?),
    };
    Ok(ProviderClient { proxy })
}

fn make_client(route: &Route) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("lepton-snippet-app");
    match route {
        Route::System => {}
        Route::Direct => {
            builder = builder.no_proxy();
        }
        Route::Proxy(url) => {
            builder = builder
                .no_proxy()
                .proxy(Proxy::all(url.as_str()).map_err(|_| "Invalid proxy address")?);
        }
    }
    builder
        .build()
        .map_err(|_| "Unable to initialize provider network".into())
}

fn parse_pac_result(result: &str) -> Result<Vec<Route>, String> {
    let mut routes = Vec::new();
    for entry in result
        .split(';')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        let mut parts = entry.split_whitespace();
        let kind = parts.next().unwrap_or("").to_ascii_uppercase();
        if kind == "DIRECT" && parts.next().is_none() {
            routes.push(Route::Direct);
            continue;
        }
        let address = parts.next().ok_or("Invalid PAC result")?;
        if parts.next().is_some() {
            return Err("Invalid PAC result".into());
        }
        let scheme = match kind.as_str() {
            "PROXY" | "HTTP" => "http",
            "HTTPS" => "https",
            "SOCKS" | "SOCKS4" => "socks4",
            "SOCKS5" => "socks5",
            _ => return Err("Unsupported PAC proxy type".into()),
        };
        routes.push(Route::Proxy(normalize_proxy(address, scheme)?));
    }
    if routes.is_empty() {
        return Err("PAC script returned no proxy routes".into());
    }
    Ok(routes)
}

type PacCache = std::collections::HashMap<String, (Instant, String)>;
static PAC_CACHE: OnceLock<tokio::sync::Mutex<PacCache>> = OnceLock::new();
async fn pac_script(url: &Url) -> Result<String, String> {
    let mut cache = PAC_CACHE
        .get_or_init(|| tokio::sync::Mutex::new(PacCache::new()))
        .lock()
        .await;
    if let Some((at, script)) = cache.get(url.as_str()) {
        if at.elapsed() < Duration::from_secs(300) {
            return Ok(script.clone());
        }
    }
    const LIMIT: usize = 1024 * 1024;
    let bytes = if url.scheme() == "file" {
        let path = url.to_file_path().map_err(|_| "Invalid PAC file URL")?;
        let data = tokio::task::spawn_blocking(move || {
            use std::io::Read;
            let file = std::fs::File::open(path)?;
            let mut data = Vec::new();
            file.take((LIMIT + 1) as u64).read_to_end(&mut data)?;
            Ok::<_, std::io::Error>(data)
        })
        .await
        .map_err(|_| "Unable to read PAC file")?
        .map_err(|_| "Unable to read PAC file")?;
        if data.len() > LIMIT {
            return Err("PAC script exceeds the supported size".into());
        }
        data
    } else {
        let client = Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::limited(3))
            .build()
            .map_err(|_| "Unable to initialize PAC download")?;
        let mut response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|_| "Unable to download PAC script")?
            .error_for_status()
            .map_err(|_| "Unable to download PAC script")?;
        if response
            .content_length()
            .is_some_and(|length| length > LIMIT as u64)
        {
            return Err("PAC script exceeds the supported size".into());
        }
        let mut data = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Unable to download PAC script")?
        {
            if chunk.len() > LIMIT.saturating_sub(data.len()) {
                return Err("PAC script exceeds the supported size".into());
            }
            data.extend_from_slice(&chunk);
        }
        data
    };
    let script = String::from_utf8(bytes).map_err(|_| "PAC script is not UTF-8")?;
    cache.insert(url.to_string(), (Instant::now(), script.clone()));
    Ok(script)
}

impl ProviderClient {
    async fn routes(&self, target: &Url) -> Result<Vec<Route>, String> {
        match &self.proxy {
            ProxyConfig::System => Ok(vec![Route::System]),
            ProxyConfig::Fixed(rules) => Ok(rules.select(target)),
            ProxyConfig::Pac(url) => {
                let script = pac_script(url).await?;
                let target = target.to_string();
                let output = tokio::task::spawn_blocking(move || {
                    proxyres::execute::get_proxies_for_url(&script, &target)
                })
                .await
                .map_err(|_| "Unable to evaluate PAC script")?
                .map_err(|_| "Unable to evaluate PAC script")?;
                parse_pac_result(&output)
            }
        }
    }
    pub async fn send(
        &self,
        method: Method,
        url: Url,
        auth: Auth<'_>,
        accept: Option<&str>,
        body: Option<Value>,
    ) -> Result<reqwest::Response, RequestError> {
        let routes = self
            .routes(&url)
            .await
            .map_err(RequestError::Configuration)?;
        for (index, route) in routes.iter().enumerate() {
            let client = make_client(route).map_err(RequestError::Configuration)?;
            let mut request = client.request(method.clone(), url.clone());
            match auth {
                Auth::None => {}
                Auth::Bearer(token) => {
                    request = request.bearer_auth(token);
                }
                Auth::PrivateToken(token) => {
                    request = request.header("PRIVATE-TOKEN", token);
                }
            }
            if let Some(accept) = accept {
                request = request.header("Accept", accept);
            }
            if let Some(body) = &body {
                request = request.json(body);
            }
            match request.send().await {
                Ok(response) => return Ok(response),
                Err(error)
                    if index + 1 < routes.len()
                        && (error.is_connect()
                            || method == Method::GET
                            || method == Method::HEAD) =>
                {
                    continue
                }
                Err(_) => return Err(RequestError::Network),
            }
        }
        Err(RequestError::Network)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    #[test]
    fn supports_proxy_lists_and_local_bypass() {
        let rules = ProxyRules::parse(
            "http=proxy-one:8080,direct://;https=https://proxy-two:8443;socks=proxy-three:1080",
        )
        .unwrap();
        assert_eq!(
            rules.select(&Url::parse("http://example.com").unwrap()),
            vec![
                Route::Proxy(Url::parse("http://proxy-one:8080").unwrap()),
                Route::Direct
            ]
        );
        assert_eq!(
            rules.select(&Url::parse("https://example.com").unwrap()),
            vec![Route::Proxy(Url::parse("https://proxy-two:8443").unwrap())]
        );
        for local in [
            "http://localhost/",
            "http://intranet/",
            "http://127.2.3.4/",
            "http://[::1]/",
        ] {
            assert_eq!(
                rules.select(&Url::parse(local).unwrap()),
                vec![Route::Direct]
            );
        }
        assert!(ProxyRules::parse("http=one;http=two").is_err());
        assert!(provider_client(Some("pac+https://example.test/proxy.pac")).is_ok());
        assert!(provider_client(Some("pac+ftp://example.test/proxy.pac")).is_err());
    }
    #[test]
    fn parses_pac_routes_in_order() {
        assert_eq!(
            parse_pac_result("PROXY one:8080; SOCKS5 two:1080; DIRECT").unwrap(),
            vec![
                Route::Proxy(Url::parse("http://one:8080").unwrap()),
                Route::Proxy(Url::parse("socks5://two:1080").unwrap()),
                Route::Direct
            ]
        );
        assert!(parse_pac_result("PROXY").is_err());
    }

    #[test]
    fn pac_script_is_evaluated_and_falls_back_to_direct() {
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = server.local_addr().unwrap();
        let unused = TcpListener::bind("127.0.0.1:0").unwrap();
        let unavailable_proxy = unused.local_addr().unwrap();
        drop(unused);
        let thread = std::thread::spawn(move || {
            let (mut stream, _) = server.accept().unwrap();
            let mut bytes = [0; 2048];
            let length = stream.read(&mut bytes).unwrap();
            assert!(String::from_utf8_lossy(&bytes[..length]).contains("GET /resource"));
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .unwrap();
        });
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("proxy.pac");
        std::fs::write(&path, format!("function FindProxyForURL(url, host) {{ return 'PROXY {unavailable_proxy}; DIRECT'; }}")).unwrap();
        let pac = format!("pac+{}", Url::from_file_path(path).unwrap());
        let client = provider_client(Some(&pac)).unwrap();
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let response = client
                .send(
                    Method::GET,
                    Url::parse(&format!("http://{address}/resource")).unwrap(),
                    Auth::None,
                    None,
                    None,
                )
                .await
                .unwrap();
            assert_eq!(response.text().await.unwrap(), "ok");
        });
        thread.join().unwrap();
    }

    #[test]
    fn proxy_failover_does_not_repeat_a_write_after_an_uncertain_response() {
        let proxy = TcpListener::bind("127.0.0.1:0").unwrap();
        let proxy_address = proxy.local_addr().unwrap();
        let destination = TcpListener::bind("127.0.0.1:0").unwrap();
        destination.set_nonblocking(true).unwrap();
        let address = destination.local_addr().unwrap();
        let thread = std::thread::spawn(move || {
            let (mut stream, _) = proxy.accept().unwrap();
            let mut bytes = [0; 2048];
            let length = stream.read(&mut bytes).unwrap();
            assert!(String::from_utf8_lossy(&bytes[..length]).starts_with("POST "));
        });
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("write-proxy.pac");
        std::fs::write(
            &path,
            format!(
                "function FindProxyForURL(url, host) {{ return 'PROXY {proxy_address}; DIRECT'; }}"
            ),
        )
        .unwrap();
        let client =
            provider_client(Some(&format!("pac+{}", Url::from_file_path(path).unwrap()))).unwrap();
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            assert!(matches!(
                client
                    .send(
                        Method::POST,
                        Url::parse(&format!("http://{address}/resource")).unwrap(),
                        Auth::None,
                        None,
                        Some(serde_json::json!({"test":true}))
                    )
                    .await,
                Err(RequestError::Network)
            ));
        });
        thread.join().unwrap();
        assert!(
            matches!(destination.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
        );
    }

    #[test]
    fn downloads_pac_without_forwarding_provider_credentials() {
        let pac_server = TcpListener::bind("127.0.0.1:0").unwrap();
        let pac_address = pac_server.local_addr().unwrap();
        let destination = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = destination.local_addr().unwrap();
        let pac_thread = std::thread::spawn(move || {
            let (mut stream, _) = pac_server.accept().unwrap();
            let mut bytes = [0; 2048];
            let length = stream.read(&mut bytes).unwrap();
            assert!(!String::from_utf8_lossy(&bytes[..length]).contains("test-only-token"));
            let body = "function FindProxyForURL(url, host) { return 'DIRECT'; }";
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
        });
        let target_thread = std::thread::spawn(move || {
            let (mut stream, _) = destination.accept().unwrap();
            let mut bytes = [0; 2048];
            let length = stream.read(&mut bytes).unwrap();
            assert!(String::from_utf8_lossy(&bytes[..length]).contains("test-only-token"));
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .unwrap();
        });
        let client = provider_client(Some(&format!("pac+http://{pac_address}/proxy.pac"))).unwrap();
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let response = client
                .send(
                    Method::GET,
                    Url::parse(&format!("http://{address}/resource")).unwrap(),
                    Auth::Bearer("test-only-token"),
                    None,
                    None,
                )
                .await
                .unwrap();
            assert_eq!(response.text().await.unwrap(), "ok");
        });
        pac_thread.join().unwrap();
        target_thread.join().unwrap();
    }
}
