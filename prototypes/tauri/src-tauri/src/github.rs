//! GitHub Gist API transport. Tokens are session-only and never logged.
use reqwest::{Client, Method, Url};
use serde_json::{json, Value};
use std::time::Duration;

pub struct GitHub {
    base: Url,
    token: String,
    http: Client,
}
impl GitHub {
    pub fn new(host: &str, token: String) -> Result<Self, String> {
        let mut base = Url::parse(host).map_err(|_| "Invalid GitHub URL")?;
        if !matches!(base.scheme(), "http" | "https")
            || base.host_str().is_none()
            || !base.username().is_empty()
            || base.password().is_some()
            || base.query().is_some()
            || base.fragment().is_some()
        {
            return Err("Invalid GitHub URL".into());
        }
        if token.trim().is_empty() {
            return Err("GitHub token is required".into());
        }
        if base
            .host_str()
            .is_some_and(|h| h.eq_ignore_ascii_case("github.com"))
            && base.path() == "/"
        {
            base = Url::parse("https://api.github.com/").map_err(|_| "Invalid GitHub URL")?;
        } else {
            let path = base.path().trim_end_matches('/').to_owned();
            base.set_path(&format!("{path}/api/v3/"));
        }
        let http = Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent("lepton-snippet-app")
            .build()
            .map_err(|e| e.without_url().to_string())?;
        Ok(Self { base, token, http })
    }
    fn url(&self, parts: &[&str]) -> Result<Url, String> {
        let mut url = self.base.clone();
        {
            let mut path = url.path_segments_mut().map_err(|_| "Invalid GitHub URL")?;
            path.pop_if_empty();
            for part in parts {
                path.push(part);
            }
        }
        Ok(url)
    }
    async fn response(
        &self,
        method: Method,
        url: Url,
        body: Option<Value>,
    ) -> Result<reqwest::Response, String> {
        let mut request = self
            .http
            .request(method, url)
            .bearer_auth(&self.token)
            .header("Accept", "application/vnd.github+json");
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request
            .send()
            .await
            .map_err(|e| e.without_url().to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "GitHub request failed (HTTP {})",
                response.status().as_u16()
            ));
        }
        Ok(response)
    }
    async fn json(&self, method: Method, url: Url, body: Option<Value>) -> Result<Value, String> {
        self.response(method, url, body)
            .await?
            .json()
            .await
            .map_err(|e| e.without_url().to_string())
    }
    pub async fn profile(&self) -> Result<Value, String> {
        self.json(Method::GET, self.url(&["user"])?, None).await
    }
    pub async fn list(&self) -> Result<Vec<Value>, String> {
        let mut page = 1u32;
        let mut all = Vec::new();
        loop {
            let mut url = self.url(&["gists"])?;
            url.query_pairs_mut()
                .append_pair("per_page", "100")
                .append_pair("page", &page.to_string());
            let response = self.response(Method::GET, url, None).await?;
            let snippets: Vec<Value> = response
                .json()
                .await
                .map_err(|e| e.without_url().to_string())?;
            let count = snippets.len();
            all.extend(snippets);
            if count < 100 {
                break;
            }
            page = page.checked_add(1).ok_or("Too many GitHub pages")?;
        }
        Ok(all)
    }
    pub async fn get(&self, id: &str) -> Result<Value, String> {
        valid_id(id)?;
        let gist = self
            .json(Method::GET, self.url(&["gists", id])?, None)
            .await?;
        // Never silently edit incomplete files. Raw URLs can point at a different
        // origin and must not receive the access token.
        if gist.get("truncated").and_then(Value::as_bool) == Some(true)
            || gist
                .get("files")
                .and_then(Value::as_object)
                .is_some_and(|files| {
                    files
                        .values()
                        .any(|f| f.get("truncated").and_then(Value::as_bool) == Some(true))
                })
        {
            return Err("GitHub returned truncated snippet content; this snippet cannot yet be edited safely".into());
        }
        Ok(gist)
    }
    pub async fn create(
        &self,
        description: &str,
        files: &Value,
        public: bool,
    ) -> Result<Value, String> {
        if files.as_object().is_none_or(|files| files.is_empty()) {
            return Err("A snippet must contain a file".into());
        }
        let created = self
            .json(
                Method::POST,
                self.url(&["gists"])?,
                Some(json!({"description":description,"files":files,"public":public})),
            )
            .await?;
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .ok_or("GitHub response has no gist ID")?;
        self.get(id).await
    }
    pub async fn update(
        &self,
        id: &str,
        description: &str,
        files: &Value,
    ) -> Result<Value, String> {
        valid_id(id)?;
        if !files.is_object() {
            return Err("Invalid files".into());
        }
        self.json(
            Method::PATCH,
            self.url(&["gists", id])?,
            Some(json!({"description":description,"files":files})),
        )
        .await?;
        self.get(id).await
    }
    pub async fn delete(&self, id: &str) -> Result<(), String> {
        valid_id(id)?;
        self.response(Method::DELETE, self.url(&["gists", id])?, None)
            .await?;
        Ok(())
    }
}
fn valid_id(id: &str) -> Result<(), String> {
    if id.is_empty() || !id.bytes().all(|c| c.is_ascii_alphanumeric()) {
        Err("Invalid GitHub gist ID".into())
    } else {
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_hosts_and_paths() {
        let api = GitHub::new("https://github.com", "test".into()).unwrap();
        assert_eq!(
            api.url(&["gists", "123abc"]).unwrap().as_str(),
            "https://api.github.com/gists/123abc"
        );
        let enterprise = GitHub::new("https://example.test", "test".into()).unwrap();
        assert_eq!(
            enterprise.url(&["user"]).unwrap().as_str(),
            "https://example.test/api/v3/user"
        );
        assert!(GitHub::new("https://user:pass@example.test", "test".into()).is_err());
        assert!(valid_id("../1").is_err());
    }
    #[test]
    fn does_not_forward_credentials_on_redirect() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
        };
        let target = TcpListener::bind("127.0.0.1:0").unwrap();
        target.set_nonblocking(true).unwrap();
        let attacker = target.local_addr().unwrap();
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let origin = server.local_addr().unwrap();
        let thread = thread::spawn(move || {
            let (mut conn, _) = server.accept().unwrap();
            let mut input = [0; 4096];
            let _ = conn.read(&mut input);
            write!(conn,"HTTP/1.1 302 Found\r\nLocation: http://{attacker}/leak\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
        });
        tauri::async_runtime::block_on(async {
            let api = GitHub::new(&format!("http://{origin}"), "test-only-token".into()).unwrap();
            assert!(api.profile().await.is_err());
        });
        thread.join().unwrap();
        assert!(target.accept().is_err());
    }

    #[test]
    fn gist_operations_use_the_expected_api_methods_and_paths() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let routes = [
                ("GET", "/api/v3/user", r#"{"login":"test"}"#),
                (
                    "GET",
                    "/api/v3/gists?per_page=100&page=1",
                    r#"[{"id":"abc"}]"#,
                ),
                ("POST", "/api/v3/gists", r#"{"id":"abc"}"#),
                (
                    "GET",
                    "/api/v3/gists/abc",
                    r#"{"id":"abc","files":{"a.js":{"content":"one"}}}"#,
                ),
                ("PATCH", "/api/v3/gists/abc", r#"{"id":"abc"}"#),
                (
                    "GET",
                    "/api/v3/gists/abc",
                    r#"{"id":"abc","files":{"a.js":{"content":"two"}}}"#,
                ),
                ("DELETE", "/api/v3/gists/abc", ""),
            ];
            for (method, path, body) in routes {
                let (mut conn, _) = listener.accept().unwrap();
                conn.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
                let mut request = Vec::new();
                let mut chunk = [0; 4096];
                loop {
                    let count = conn.read(&mut chunk).unwrap();
                    request.extend_from_slice(&chunk[..count]);
                    if request.windows(4).any(|w| w == b"\r\n\r\n") || count == 0 {
                        break;
                    }
                }
                let header = String::from_utf8_lossy(&request);
                assert!(header.starts_with(&format!("{method} {path} ")));
                assert!(header
                    .to_lowercase()
                    .contains("authorization: bearer test-token"));
                let status = if method == "DELETE" {
                    "204 No Content"
                } else {
                    "200 OK"
                };
                write!(conn, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            let api = GitHub::new(&format!("http://{address}"), "test-token".into()).unwrap();
            assert_eq!(api.profile().await.unwrap()["login"], "test");
            assert_eq!(api.list().await.unwrap().len(), 1);
            assert_eq!(
                api.create("title", &json!({"a.js":{"content":"one"}}), false)
                    .await
                    .unwrap()["files"]["a.js"]["content"],
                "one"
            );
            assert_eq!(
                api.update("abc", "title", &json!({"a.js":{"content":"two"}}))
                    .await
                    .unwrap()["files"]["a.js"]["content"],
                "two"
            );
            api.delete("abc").await.unwrap();
        });
        server.join().unwrap();
    }

    #[test]
    #[ignore = "requires a GitHub token authorized for disposable Gist testing"]
    fn live_private_gist_round_trip() {
        let token = std::env::var("LEPTON_TEST_GITHUB_TOKEN").expect("test token required");
        tauri::async_runtime::block_on(async {
            let api = GitHub::new("https://github.com", token).unwrap();
            api.profile().await.expect("read authenticated profile");
            // Record the ID immediately so every later failure still cleans up.
            let created = api.json(Method::POST, api.url(&["gists"]).unwrap(), Some(json!({
                "description": "Lepton Rust migration temporary test",
                "public": false,
                "files": { "main.rs": {"content": "fn main() {}\n"}, "notes.md": {"content": "# Test\n"} }
            }))).await.expect("create disposable private gist");
            let id = created
                .get("id")
                .and_then(Value::as_str)
                .expect("gist id")
                .to_owned();
            let outcome = async {
                if created.get("public").and_then(Value::as_bool) != Some(false) {
                    return Err("Gist was not private".to_owned());
                }
                let list = api.list().await?;
                if !list.iter().any(|gist| gist["id"] == id) {
                    return Err("Created gist missing from list".to_owned());
                }
                let updated = api
                    .update(
                        &id,
                        "Lepton Rust migration temporary test updated",
                        &json!({
                            "main.rs": {"content": "fn main() { println!(\"updated\"); }\n"},
                            "notes.md": null,
                            "unicode.txt": {"content": "日本語 café\n"}
                        }),
                    )
                    .await?;
                if updated["files"]["main.rs"]["content"]
                    != "fn main() { println!(\"updated\"); }\n"
                    || updated["files"]["unicode.txt"]["content"] != "日本語 café\n"
                    || updated["files"].get("notes.md").is_some()
                {
                    return Err("Gist edit did not persist".to_owned());
                }
                Ok::<(), String>(())
            }
            .await;
            let deletion = api.delete(&id).await;
            outcome.expect("live GitHub Gist round trip");
            deletion.expect("delete disposable gist");
        });
    }
}
