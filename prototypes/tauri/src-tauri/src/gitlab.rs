//! GitLab personal-snippet transport for the migration. This module does not
//! persist credentials and never follows redirects carrying authentication.
use percent_encoding::percent_decode_str;
use reqwest::{Client, Method, Url};
use serde_json::{json, Map, Value};

fn body_error(error: reqwest::Error) -> String {
    if error.is_decode() {
        "GitLab returned an invalid response".into()
    } else {
        "GitLab network request failed".into()
    }
}

pub struct GitLab {
    base: Url,
    token: String,
    http: Client,
}

impl GitLab {
    #[cfg(test)]
    pub fn new(base: &str, token: String) -> Result<Self, String> {
        Self::new_with_proxy(base, token, None)
    }
    pub fn new_with_proxy(base: &str, token: String, proxy: Option<&str>) -> Result<Self, String> {
        let mut base = Url::parse(base).map_err(|_| "Invalid GitLab URL")?;
        if !matches!(base.scheme(), "http" | "https")
            || base.host_str().is_none()
            || !base.username().is_empty()
            || base.password().is_some()
            || base.query().is_some()
            || base.fragment().is_some()
        {
            return Err("Invalid GitLab URL".into());
        }
        if token.trim().is_empty() {
            return Err("GitLab token is required".into());
        }
        let path = base.path().trim_end_matches('/').to_owned();
        base.set_path(&format!("{path}/api/v4/"));
        let http = crate::http_client::provider_client(proxy)?;
        Ok(Self { base, token, http })
    }
    fn url(&self, parts: &[&str]) -> Result<Url, String> {
        let mut url = self.base.clone();
        {
            let mut segments = url.path_segments_mut().map_err(|_| "Invalid GitLab URL")?;
            segments.pop_if_empty();
            for part in parts {
                segments.push(part);
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
            .header("PRIVATE-TOKEN", &self.token);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request
            .send()
            .await
            .map_err(|_| "GitLab network request failed")?;
        if !response.status().is_success() {
            return Err(format!(
                "GitLab request failed (HTTP {})",
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
        let mut all = Vec::new();
        let mut page = 1u32;
        loop {
            let mut url = self.url(&["snippets"])?;
            url.query_pairs_mut()
                .append_pair("per_page", "100")
                .append_pair("page", &page.to_string());
            let response = self.response(Method::GET, url, None).await?;
            let next = response
                .headers()
                .get("x-next-page")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u32>().ok())
                .filter(|next| *next > page);
            let snippets: Vec<Value> = response.json().await.map_err(body_error)?;
            let count = snippets.len();
            all.extend(
                snippets
                    .into_iter()
                    .filter(|s| s.get("project_id").is_none_or(Value::is_null)),
            );
            match next {
                Some(value) => page = value,
                None if count == 100 => page = page.checked_add(1).ok_or("Too many pages")?,
                None => break,
            }
        }
        Ok(all)
    }
    async fn metadata(&self, id: &str) -> Result<Value, String> {
        valid_id(id)?;
        self.json(Method::GET, self.url(&["snippets", id])?, None)
            .await
    }
    pub async fn get(&self, id: &str) -> Result<Value, String> {
        let snippet = self.metadata(id).await?;
        let files = descriptors(&snippet);
        let mut contents = Map::new();
        for (path, raw) in &files {
            let url = match raw_ref(raw) {
                Some(reference) => self.url(&["snippets", id, "files", &reference, path, "raw"])?,
                None if files.len() == 1 => self.url(&["snippets", id, "raw"])?,
                None => return Err("GitLab did not provide a raw file reference".into()),
            };
            let content = self
                .response(Method::GET, url, None)
                .await?
                .text()
                .await
                .map_err(body_error)?;
            contents.insert(path.clone(), json!(content));
        }
        Ok(normalize(snippet, &contents))
    }
    pub async fn create(
        &self,
        description: &str,
        files: &Value,
        public: bool,
    ) -> Result<Value, String> {
        let files = files.as_object().ok_or("Invalid files")?;
        if files.is_empty() {
            return Err("A snippet must contain a file".into());
        }
        let first = files.keys().next().ok_or("A snippet must contain a file")?;
        let (title, description) = metadata(description, first, None);
        let mut records = Vec::new();
        for (path, file) in files {
            let content = file
                .get("content")
                .and_then(Value::as_str)
                .ok_or("Invalid file content")?;
            records.push(json!({"file_path":path,"content":content}));
        }
        let response = self.response(Method::POST, self.url(&["snippets"])?, Some(json!({"title":title,"description":description,"visibility":if public {"public"} else {"private"},"files":records}))).await?;
        let created: Value = response
            .json()
            .await
            .map_err(|_| "GitLab may have created the snippet. Sync before retrying.")?;
        let id = id_of(&created)
            .map_err(|_| "GitLab may have created the snippet. Sync before retrying.")?;
        match self.get(&id).await {
            Ok(snippet) => Ok(snippet),
            Err(_) => saved_fallback(
                normalize(created, &Map::new()),
                &title,
                &description,
                &Value::Object(files.clone()),
            ),
        }
    }
    pub async fn update(
        &self,
        id: &str,
        description: &str,
        patch: &Value,
    ) -> Result<Value, String> {
        let existing = self.get(id).await?;
        let files = patch.as_object().ok_or("Invalid files")?;
        let current = existing
            .get("files")
            .and_then(Value::as_object)
            .ok_or("Invalid GitLab response")?;
        let first = files
            .iter()
            .find(|(_, v)| !v.is_null())
            .map(|(k, _)| k.as_str())
            .unwrap_or("Untitled snippet");
        let (title, description) = metadata(
            description,
            first,
            existing.get("title").and_then(Value::as_str),
        );
        let mut actions = Vec::new();
        for (path, file) in files {
            let exists = current.contains_key(path);
            if file.is_null() {
                if exists {
                    actions.push(json!({"action":"delete","file_path":path}));
                }
            } else {
                let content = file
                    .get("content")
                    .and_then(Value::as_str)
                    .ok_or("Invalid file content")?;
                actions.push(json!({"action":if exists {"update"} else {"create"},"file_path":path,"content":content}));
            }
        }
        let mut body = json!({"title":title,"description":description});
        if !actions.is_empty() {
            body["files"] = json!(actions);
        }
        let fallback = saved_fallback(existing, &title, &description, patch)?;
        self.response(Method::PUT, self.url(&["snippets", id])?, Some(body))
            .await?;
        match self.get(id).await {
            Ok(snippet) => Ok(snippet),
            Err(_) => Ok(fallback),
        }
    }
    pub async fn delete(&self, id: &str) -> Result<(), String> {
        valid_id(id)?;
        self.response(Method::DELETE, self.url(&["snippets", id])?, None)
            .await?;
        Ok(())
    }
}
fn saved_fallback(
    mut snippet: Value,
    title: &str,
    description: &str,
    patch: &Value,
) -> Result<Value, String> {
    let root = snippet.as_object_mut().ok_or("Invalid GitLab response")?;
    root.insert("title".into(), json!(title));
    root.insert("providerTitle".into(), json!(title));
    root.insert("providerDescription".into(), json!(description));
    root.insert(
        "description".into(),
        json!(format!("[{title}] {description}").trim()),
    );
    root.insert("_leptonRefreshPending".into(), json!(true));
    let files = root
        .get_mut("files")
        .and_then(Value::as_object_mut)
        .ok_or("Invalid GitLab response")?;
    for (path, entry) in patch.as_object().ok_or("Invalid files")? {
        if entry.is_null() {
            files.shift_remove(path);
        } else {
            let content = entry
                .get("content")
                .and_then(Value::as_str)
                .ok_or("Invalid file content")?;
            let file = files.entry(path.clone()).or_insert_with(|| json!({"filename":path,"raw_url":"","language":crate::local_gists::language(path)}));
            file["content"] = json!(content);
        }
    }
    if files.is_empty() {
        return Err("A snippet must contain a file".into());
    }
    Ok(snippet)
}
fn valid_id(id: &str) -> Result<(), String> {
    if id.is_empty() || !id.bytes().all(|c| c.is_ascii_digit()) {
        Err("Invalid GitLab snippet ID".into())
    } else {
        Ok(())
    }
}
fn id_of(value: &Value) -> Result<String, String> {
    value
        .get("id")
        .and_then(|v| {
            v.as_u64()
                .map(|x| x.to_string())
                .or_else(|| v.as_str().map(str::to_owned))
        })
        .ok_or("GitLab response has no snippet ID".into())
}
fn descriptors(value: &Value) -> Vec<(String, String)> {
    let list = value
        .get("files")
        .and_then(Value::as_array)
        .map(|files| {
            files
                .iter()
                .filter_map(|f| {
                    Some((
                        f.get("path")
                            .or_else(|| f.get("file_path"))?
                            .as_str()?
                            .to_owned(),
                        f.get("raw_url")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_owned(),
                    ))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if !list.is_empty() {
        return list;
    }
    value
        .get("file_name")
        .and_then(Value::as_str)
        .map(|s| {
            vec![(
                s.into(),
                value
                    .get("raw_url")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .into(),
            )]
        })
        .unwrap_or_default()
}
fn raw_ref(raw: &str) -> Option<String> {
    let url = Url::parse(raw).ok()?;
    let pieces: Vec<_> = url.path_segments()?.collect();
    let index = pieces.iter().position(|s| *s == "raw")?;
    percent_decode_str(pieces.get(index + 1)?)
        .decode_utf8()
        .ok()
        .map(|s| s.into_owned())
}
fn metadata(input: &str, fallback: &str, old: Option<&str>) -> (String, String) {
    let input = input.trim();
    if let Some(title) = old {
        let prefix = format!("[{title}]");
        if let Some(rest) = input.strip_prefix(&prefix) {
            return (title.into(), rest.trim().into());
        }
    }
    if input.starts_with('[') {
        let mut depth = 0;
        for (i, c) in input.char_indices() {
            if c == '[' {
                depth += 1
            } else if c == ']' {
                depth -= 1;
                if depth == 0 {
                    let title = input[1..i].trim();
                    return (
                        if title.is_empty() { fallback } else { title }
                            .chars()
                            .take(255)
                            .collect(),
                        input[i + 1..].trim().into(),
                    );
                }
            }
        }
    }
    (fallback.chars().take(255).collect(), input.into())
}
pub fn normalize_brief(snippet: Value) -> Value {
    normalize(snippet, &Map::new())
}
fn normalize(mut snippet: Value, contents: &Map<String, Value>) -> Value {
    let id = id_of(&snippet).unwrap_or_default();
    let title = snippet
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_owned();
    let description = snippet
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_owned();
    let mut files = Map::new();
    for (path, raw) in descriptors(&snippet) {
        let mut file =
            json!({"filename":path,"raw_url":raw,"language":crate::local_gists::language(&path)});
        if let Some(content) = contents.get(&path) {
            file["content"] = content.clone();
        }
        files.insert(path, file);
    }
    snippet["id"] = json!(id);
    snippet["providerTitle"] = json!(title);
    snippet["providerDescription"] = json!(description);
    snippet["description"] = json!(if title.is_empty() {
        description
    } else {
        format!("[{title}] {description}").trim().to_owned()
    });
    snippet["public"] = json!(snippet["visibility"] == "public");
    snippet["html_url"] = snippet["web_url"].clone();
    snippet["history_url"] = Value::Null;
    snippet["providerType"] = json!("gitlab");
    snippet["files"] = Value::Object(files);
    snippet
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn confirmed_saves_survive_refresh_failures() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
            time::Duration,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            for (method, path, status, body) in [
                (
                    "POST",
                    "/api/v4/snippets",
                    "201 Created",
                    r#"{"id":42,"title":"new","description":"tag","visibility":"private","files":[]}"#,
                ),
                ("GET", "/api/v4/snippets/42", "503 Service Unavailable", ""),
                (
                    "GET",
                    "/api/v4/snippets/42",
                    "200 OK",
                    r#"{"id":42,"title":"new","description":"tag","visibility":"private","file_name":"old.txt"}"#,
                ),
                ("GET", "/api/v4/snippets/42/raw", "200 OK", "old content"),
                ("PUT", "/api/v4/snippets/42", "200 OK", "{}"),
                ("GET", "/api/v4/snippets/42", "503 Service Unavailable", ""),
            ] {
                let (mut connection, _) = listener.accept().unwrap();
                connection
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut input = [0; 8192];
                let size = connection.read(&mut input).unwrap();
                assert!(String::from_utf8_lossy(&input[..size])
                    .starts_with(&format!("{method} {path} ")));
                write!(
                    connection,
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            let api = GitLab::new(&format!("http://{address}"), "test-token".into()).unwrap();
            let created = api
                .create(
                    "[new] tag",
                    &json!({"new.txt":{"content":"created"}}),
                    false,
                )
                .await
                .unwrap();
            assert_eq!(created["files"]["new.txt"]["content"], "created");
            assert_eq!(created["_leptonRefreshPending"], true);
            let updated = api
                .update(
                    "42",
                    "[new] changed",
                    &json!({"new.txt":{"content":"edited"}}),
                )
                .await
                .unwrap();
            assert_eq!(updated["files"]["old.txt"]["content"], "old content");
            assert_eq!(updated["files"]["new.txt"]["content"], "edited");
            assert_eq!(updated["_leptonRefreshPending"], true);
        });
        server.join().unwrap();
    }
    #[test]
    fn rejects_unsafe_urls_and_id() {
        assert!(GitLab::new("https://u:p@example.com", "token".into()).is_err());
        assert!(GitLab::new("https://example.com/?key=x", "token".into()).is_err());
        assert!(valid_id("../1").is_err());
        assert!(valid_id("123").is_ok());
    }
    #[test]
    fn encodes_segments_and_parses_refs() {
        let api = GitLab::new("http://127.0.0.1:8080/gitlab", "x".into()).unwrap();
        assert_eq!(
            api.url(&["snippets", "1", "files", "main", "dir/a b.md", "raw"])
                .unwrap()
                .path(),
            "/gitlab/api/v4/snippets/1/files/main/dir%2Fa%20b.md/raw"
        );
        assert_eq!(
            raw_ref("https://example.com/-/snippets/1/raw/feature%2Fx/a.md").as_deref(),
            Some("feature/x")
        );
    }
    #[test]
    fn maps_nested_title_metadata() {
        assert_eq!(
            metadata("[hello [world]] #tag", "fallback", None),
            ("hello [world]".into(), "#tag".into())
        );
    }

    #[test]
    #[ignore = "requires a disposable GitLab instance and test token"]
    fn live_personal_snippet_round_trip() {
        let base = std::env::var("LEPTON_TEST_GITLAB_URL").expect("test URL required");
        let token = std::env::var("LEPTON_TEST_GITLAB_TOKEN").expect("test token required");
        tauri::async_runtime::block_on(async {
            let api = GitLab::new(&base, token).unwrap();
            assert!(api.profile().await.is_ok());
            let created = api
                .create(
                    "[Rust migration test] #local",
                    &json!({
                        "a.js": {"content": "const before = 1;\n"},
                        "nested/note.md": {"content": "# Original\n"}
                    }),
                    false,
                )
                .await
                .expect("create and hydrate");
            let id = id_of(&created).unwrap();
            let outcome = async {
                let all = api.list().await?;
                if !all
                    .iter()
                    .any(|entry| id_of(entry).ok().as_deref() == Some(&id))
                {
                    return Err("Created snippet missing from list".to_owned());
                }
                let updated = api
                    .update(
                        &id,
                        "[Rust migration test] #changed",
                        &json!({
                            "a.js": {"content": "const after = 2;\n"},
                            "nested/note.md": null,
                            "new.txt": {"content": "additional content"}
                        }),
                    )
                    .await?;
                if updated["files"]["a.js"]["content"] != "const after = 2;\n"
                    || updated["files"]["new.txt"]["content"] != "additional content"
                    || updated["files"].get("nested/note.md").is_some()
                {
                    return Err("GitLab file update did not persist".to_owned());
                }
                Ok::<(), String>(())
            }
            .await;
            let deletion = api.delete(&id).await;
            outcome.expect("live GitLab round trip");
            deletion.expect("delete disposable snippet");
        });
    }
}
