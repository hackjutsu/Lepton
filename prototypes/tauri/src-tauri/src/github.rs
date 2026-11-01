//! GitHub Gist API transport. Tokens are session-only and never logged.
use reqwest::{Client, Method, Url};
use serde_json::{json, Value};
#[cfg(test)]
use std::time::Duration;

fn body_error(error: reqwest::Error) -> String {
    if error.is_decode() {
        "GitHub returned an invalid response".into()
    } else {
        "GitHub network request failed".into()
    }
}

pub struct GitHub {
    base: Url,
    origin: Url,
    cloud: bool,
    token: String,
    http: Client,
}
impl GitHub {
    #[cfg(test)]
    pub fn new(host: &str, token: String) -> Result<Self, String> {
        Self::new_with_proxy(host, token, None)
    }
    pub fn new_with_proxy(host: &str, token: String, proxy: Option<&str>) -> Result<Self, String> {
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
        let origin = base.clone();
        let cloud = base
            .host_str()
            .is_some_and(|h| h.eq_ignore_ascii_case("github.com"))
            && base.path() == "/";
        if cloud {
            base = Url::parse("https://api.github.com/").map_err(|_| "Invalid GitHub URL")?;
        } else {
            let path = base.path().trim_end_matches('/').to_owned();
            base.set_path(&format!("{path}/api/v3/"));
        }
        let http = crate::http_client::provider_client(proxy)?;
        Ok(Self {
            base,
            origin,
            cloud,
            token,
            http,
        })
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
            .map_err(|_| "GitHub network request failed")?;
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
            .map_err(body_error)
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
            let snippets: Vec<Value> = response.json().await.map_err(body_error)?;
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
        let mut gist = self
            .json(Method::GET, self.url(&["gists", id])?, None)
            .await?;
        // A truncated file list may omit files entirely and cannot safely be edited.
        if gist.get("truncated").and_then(Value::as_bool) == Some(true) {
            return Err(
                "GitHub returned an incomplete file list; this snippet cannot be edited safely"
                    .into(),
            );
        }
        if let Some(files) = gist.get_mut("files").and_then(Value::as_object_mut) {
            for file in files.values_mut() {
                if file.get("truncated").and_then(Value::as_bool) != Some(true) {
                    continue;
                }
                let raw = file
                    .get("raw_url")
                    .and_then(Value::as_str)
                    .ok_or("GitHub returned a truncated file without a raw URL")?;
                let (url, authenticated) = self.raw_target(raw, id)?;
                let mut request = self.http.get(url);
                if authenticated {
                    request = request.bearer_auth(&self.token);
                }
                let mut response = request
                    .send()
                    .await
                    .map_err(|_| "GitHub network request failed")?;
                if !response.status().is_success() {
                    return Err(format!(
                        "GitHub raw file request failed (HTTP {})",
                        response.status().as_u16()
                    ));
                }
                const MAX_RAW_BYTES: usize = 10 * 1024 * 1024;
                if response
                    .content_length()
                    .is_some_and(|n| n > MAX_RAW_BYTES as u64)
                {
                    return Err("GitHub raw file exceeds the supported size".into());
                }
                let mut bytes = Vec::new();
                while let Some(chunk) = response
                    .chunk()
                    .await
                    .map_err(|_| "GitHub network request failed")?
                {
                    if chunk.len() > MAX_RAW_BYTES.saturating_sub(bytes.len()) {
                        return Err("GitHub raw file exceeds the supported size".into());
                    }
                    bytes.extend_from_slice(&chunk);
                }
                if file
                    .get("size")
                    .and_then(Value::as_u64)
                    .is_some_and(|size| size != bytes.len() as u64)
                {
                    return Err("GitHub raw file length did not match the API response".into());
                }
                let content =
                    String::from_utf8(bytes).map_err(|_| "GitHub raw file is not UTF-8 text")?;
                file["content"] = Value::String(content);
                file["truncated"] = Value::Bool(false);
            }
        }
        Ok(gist)
    }

    fn raw_target(&self, raw: &str, id: &str) -> Result<(Url, bool), String> {
        let url = Url::parse(raw).map_err(|_| "Invalid GitHub raw file URL")?;
        if !matches!(url.scheme(), "http" | "https")
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || !url
                .path_segments()
                .is_some_and(|parts| parts.into_iter().any(|part| part == id))
        {
            return Err("Invalid GitHub raw file URL".into());
        }
        let same_origin = url.scheme() == self.origin.scheme()
            && url.host_str() == self.origin.host_str()
            && url.port_or_known_default() == self.origin.port_or_known_default();
        let public_raw = self.cloud
            && url.scheme() == "https"
            && url.host_str() == Some("gist.githubusercontent.com")
            && url.port_or_known_default() == Some(443);
        let enterprise_raw = !self.cloud
            && url.scheme() == self.origin.scheme()
            && url.port_or_known_default() == self.origin.port_or_known_default()
            && url.host_str()
                == self
                    .origin
                    .host_str()
                    .map(|host| format!("gist.{host}"))
                    .as_deref();
        if same_origin && !self.cloud {
            Ok((url, true))
        } else if public_raw || enterprise_raw {
            Ok((url, false))
        } else {
            Err("GitHub raw file URL is outside the configured provider".into())
        }
    }
    pub async fn create(
        &self,
        description: &str,
        files: &Value,
        public: bool,
    ) -> Result<Value, String> {
        validate_patch(files, true)?;
        let response = self
            .response(
                Method::POST,
                self.url(&["gists"])?,
                Some(json!({"description":description,"files":files,"public":public})),
            )
            .await?;
        let created: Value = response
            .json()
            .await
            .map_err(|_| "GitHub may have created the snippet. Sync before retrying.")?;
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .ok_or("GitHub may have created the snippet. Sync before retrying.")?;
        match self.get(id).await {
            Ok(gist) => Ok(gist),
            Err(_) => saved_fallback(created, description, files),
        }
    }
    pub async fn update(
        &self,
        id: &str,
        description: &str,
        files: &Value,
    ) -> Result<Value, String> {
        valid_id(id)?;
        validate_patch(files, false)?;
        // Fetch a complete pre-edit snapshot before mutating the remote Gist.
        let previous = self.get(id).await?;
        let fallback = saved_fallback(previous, description, files)?;
        self.response(
            Method::PATCH,
            self.url(&["gists", id])?,
            Some(json!({"description":description,"files":files})),
        )
        .await?;
        match self.get(id).await {
            Ok(gist) => Ok(gist),
            Err(_) => Ok(fallback),
        }
    }
    pub async fn delete(&self, id: &str) -> Result<(), String> {
        valid_id(id)?;
        self.response(Method::DELETE, self.url(&["gists", id])?, None)
            .await?;
        Ok(())
    }
}

fn validate_patch(files: &Value, create: bool) -> Result<(), String> {
    let files = files.as_object().ok_or("Invalid files")?;
    if create && files.is_empty() {
        return Err("A snippet must contain a file".into());
    }
    for (name, entry) in files {
        if name.trim().is_empty() {
            return Err("Filename is required".into());
        }
        if entry.is_null() && !create {
            continue;
        }
        let content = entry
            .get("content")
            .and_then(Value::as_str)
            .ok_or("Invalid file content")?;
        if content.len() > 10 * 1024 * 1024 {
            return Err("GitHub file exceeds the supported size".into());
        }
    }
    if create && files.len() > 300 {
        return Err("GitHub snippets with more than 300 files cannot yet be edited safely".into());
    }
    Ok(())
}

fn saved_fallback(mut gist: Value, description: &str, patch: &Value) -> Result<Value, String> {
    let root = gist.as_object_mut().ok_or("Invalid GitHub response")?;
    root.insert("description".into(), json!(description));
    let files = root
        .entry("files")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or("Invalid GitHub response")?;
    for (name, entry) in patch.as_object().ok_or("Invalid files")? {
        if entry.is_null() {
            files.shift_remove(name);
            continue;
        }
        let content = entry
            .get("content")
            .and_then(Value::as_str)
            .ok_or("Invalid file content")?;
        let file = files.entry(name).or_insert_with(
            || json!({"filename":name,"language":crate::local_gists::language(name)}),
        );
        let object = file.as_object_mut().ok_or("Invalid GitHub response")?;
        object.insert("filename".into(), json!(name));
        object.insert("content".into(), json!(content));
        object.insert("truncated".into(), json!(false));
    }
    if files.is_empty() || files.len() > 300 {
        return Err("GitHub snippet must contain between 1 and 300 files".into());
    }
    root.insert("_leptonRefreshPending".into(), json!(true));
    Ok(gist)
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
    fn only_trusts_raw_urls_for_the_configured_provider_and_gist() {
        let cloud = GitHub::new("https://github.com", "test".into()).unwrap();
        assert!(
            !cloud
                .raw_target(
                    "https://gist.githubusercontent.com/user/abc/raw/rev/a.txt",
                    "abc"
                )
                .unwrap()
                .1
        );
        for url in [
            "https://evil.example/abc/raw/a",
            "http://gist.githubusercontent.com/user/abc/raw/a",
            "https://gist.githubusercontent.com/user/other/raw/a",
            "https://user:password@gist.githubusercontent.com/user/abc/raw/a",
        ] {
            assert!(cloud.raw_target(url, "abc").is_err());
        }
        let enterprise = GitHub::new("https://git.example.test:8443", "test".into()).unwrap();
        assert!(
            enterprise
                .raw_target("https://git.example.test:8443/user/abc/raw/a", "abc")
                .unwrap()
                .1
        );
        assert!(
            !enterprise
                .raw_target("https://gist.git.example.test:8443/user/abc/raw/a", "abc")
                .unwrap()
                .1
        );
        assert!(enterprise
            .raw_target("https://evil.example/abc/raw/a", "abc")
            .is_err());
    }
    #[test]
    fn hydrates_a_truncated_file_without_accepting_incomplete_content() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            for expected in ["/api/v3/gists/abc", "/user/abc/raw/rev/a.txt"] {
                let (mut conn, _) = listener.accept().unwrap();
                let mut input = [0; 4096];
                let n = conn.read(&mut input).unwrap();
                let request = String::from_utf8_lossy(&input[..n]);
                assert!(request.starts_with(&format!("GET {expected} ")));
                assert!(request
                    .to_lowercase()
                    .contains("authorization: bearer test-token"));
                let body = if expected.starts_with("/api/") {
                    json!({"id":"abc", "truncated":false, "files":{"a.txt":{"truncated":true, "size":5, "content":"H", "raw_url":format!("http://{address}/user/abc/raw/rev/a.txt")}}}).to_string()
                } else {
                    "Hello".to_owned()
                };
                write!(
                    conn,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            let api = GitHub::new(&format!("http://{address}"), "test-token".into()).unwrap();
            let gist = api.get("abc").await.unwrap();
            assert_eq!(gist["files"]["a.txt"]["content"], "Hello");
            assert_eq!(gist["files"]["a.txt"]["truncated"], false);
        });
        server.join().unwrap();
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
    fn configured_http_proxy_is_used_for_provider_requests() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut conn, _) = listener.accept().unwrap();
            let mut input = [0; 4096];
            let n = conn.read(&mut input).unwrap();
            let request = String::from_utf8_lossy(&input[..n]);
            assert!(request.starts_with("GET http://provider.example.test/api/v3/user "));
            assert!(request
                .to_lowercase()
                .contains("authorization: bearer test-token"));
            let body = r#"{"login":"test"}"#;
            write!(
                conn,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        tauri::async_runtime::block_on(async {
            let api = GitHub::new_with_proxy(
                "http://provider.example.test",
                "test-token".into(),
                Some(&format!("http://{address}")),
            )
            .unwrap();
            assert_eq!(api.profile().await.unwrap()["login"], "test");
        });
        server.join().unwrap();
    }

    #[test]
    fn a_successful_remote_save_is_not_reported_as_failed_when_refresh_fails() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            for (method, expected, status, body) in [
                (
                    "POST",
                    "/api/v3/gists",
                    "201 Created",
                    r#"{"id":"abc","files":{}}"#,
                ),
                ("GET", "/api/v3/gists/abc", "503 Service Unavailable", ""),
                (
                    "GET",
                    "/api/v3/gists/abc",
                    "200 OK",
                    r#"{"id":"abc","files":{"old.txt":{"filename":"old.txt","content":"unchanged"}}}"#,
                ),
                ("PATCH", "/api/v3/gists/abc", "200 OK", "{}"),
                ("GET", "/api/v3/gists/abc", "503 Service Unavailable", ""),
            ] {
                let (mut conn, _) = listener.accept().unwrap();
                conn.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
                let mut input = [0; 8192];
                let n = conn.read(&mut input).unwrap();
                let request = String::from_utf8_lossy(&input[..n]);
                assert!(request.starts_with(&format!("{method} {expected} ")));
                write!(
                    conn,
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            let api = GitHub::new(&format!("http://{address}"), "test-token".into()).unwrap();
            let created = api
                .create("created", &json!({"new.txt":{"content":"new"}}), false)
                .await
                .unwrap();
            assert_eq!(created["files"]["new.txt"]["content"], "new");
            assert_eq!(created["_leptonRefreshPending"], true);
            let updated = api
                .update("abc", "edited", &json!({"new.txt":{"content":"changed"}}))
                .await
                .unwrap();
            assert_eq!(updated["files"]["old.txt"]["content"], "unchanged");
            assert_eq!(updated["files"]["new.txt"]["content"], "changed");
            assert_eq!(updated["_leptonRefreshPending"], true);
        });
        server.join().unwrap();
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

    #[test]
    #[ignore = "requires a GitHub token authorized for disposable Gist testing"]
    fn live_truncated_file_round_trip() {
        let token = std::env::var("LEPTON_TEST_GITHUB_TOKEN").expect("test token required");
        tauri::async_runtime::block_on(async {
            let api = GitHub::new("https://github.com", token).unwrap();
            let content = "line of text\n".repeat(90_000);
            let created = api
                .json(
                    Method::POST,
                    api.url(&["gists"]).unwrap(),
                    Some(json!({
                        "description":"Lepton Rust temporary large file test", "public":false,
                        "files":{"large.txt":{"content":content}}
                    })),
                )
                .await
                .expect("create disposable private gist");
            let id = created["id"].as_str().expect("gist id").to_owned();
            let result = async {
                let gist = api.get(&id).await?;
                if gist["files"]["large.txt"]["content"].as_str() != Some(content.as_str()) {
                    return Err("Retrieved content did not match".to_owned());
                }
                Ok::<(), String>(())
            }
            .await;
            let deletion = api.delete(&id).await;
            result.expect("retrieve full large file");
            deletion.expect("delete disposable gist");
        });
    }
}
