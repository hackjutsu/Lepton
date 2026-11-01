#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod github;
mod github_oauth;
mod gitlab;
mod library;
mod local_gists;

use library::{Draft, Library, Snippet};
use local_gists::LocalGists;
use serde_json::Value;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

fn validated_external_url(url: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(url).map_err(|_| "Invalid external URL")?;
    if !matches!(url.scheme(), "https" | "http")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Invalid external URL".into());
    }
    Ok(url)
}

#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let url = validated_external_url(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Unable to open external URL".to_owned())
}

#[cfg(test)]
mod external_url_tests {
    use super::validated_external_url;

    #[test]
    fn accepts_web_urls_only() {
        assert!(validated_external_url("https://gist.github.com/example").is_ok());
        assert!(validated_external_url("http://localhost:8080/example").is_ok());
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "https://user:secret@example.com/",
        ] {
            assert!(validated_external_url(url).is_err());
        }
    }
}

#[tauri::command]
fn search_snippets(
    query: String,
    state: tauri::State<'_, Mutex<Library>>,
) -> Result<Vec<Snippet>, String> {
    state.lock().map_err(|e| e.to_string())?.search(&query)
}

#[tauri::command]
fn save_snippet(draft: Draft, state: tauri::State<'_, Mutex<Library>>) -> Result<Snippet, String> {
    state.lock().map_err(|e| e.to_string())?.save(draft)
}

#[tauri::command]
fn local_gist_request(
    operation: String,
    args: Vec<Value>,
    state: tauri::State<'_, Mutex<LocalGists>>,
) -> Result<Value, String> {
    let mut db = state.lock().map_err(|e| e.to_string())?;
    let string = |i: usize| {
        args.get(i)
            .and_then(Value::as_str)
            .ok_or_else(|| "Invalid argument".to_string())
    };
    match operation.as_str() {
        "GET_ALL_GISTS" => Ok(serde_json::to_value(db.list()?).map_err(|e| e.to_string())?),
        "GET_SINGLE_GIST" => db.get(string(1)?),
        "CREATE_SINGLE_GIST" => db.create(
            string(1)?,
            args.get(2).ok_or("Missing files")?,
            args.get(3).and_then(Value::as_bool).unwrap_or(false),
            string(4)?,
        ),
        "EDIT_SINGLE_GIST" => db.update(
            string(1)?,
            string(2)?,
            args.get(3).ok_or("Missing files")?,
            string(4)?,
        ),
        "DELETE_SINGLE_GIST" => {
            db.delete(string(1)?)?;
            Ok(Value::Null)
        }
        _ => Err("Unknown local snippet operation".into()),
    }
}

#[tauri::command]
async fn gitlab_request(
    base: String,
    token: String,
    operation: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let client = gitlab::GitLab::new(&base, token)?;
    let string = |i: usize| {
        args.get(i)
            .and_then(Value::as_str)
            .ok_or_else(|| "Invalid argument".to_owned())
    };
    match operation.as_str() {
        "profile" => client.profile().await,
        "list" => Ok(Value::Array(
            client
                .list()
                .await?
                .into_iter()
                .map(gitlab::normalize_brief)
                .collect(),
        )),
        "get" => client.get(string(0)?).await,
        "create" => {
            client
                .create(
                    string(0)?,
                    args.get(1).ok_or("Missing files")?,
                    args.get(2).and_then(Value::as_bool).unwrap_or(false),
                )
                .await
        }
        "update" => {
            client
                .update(string(0)?, string(1)?, args.get(2).ok_or("Missing files")?)
                .await
        }
        "delete" => {
            client.delete(string(0)?).await?;
            Ok(Value::Null)
        }
        _ => Err("Unknown GitLab operation".into()),
    }
}

#[tauri::command]
async fn github_request(
    base: String,
    token: String,
    operation: String,
    args: Vec<Value>,
) -> Result<Value, String> {
    let client = github::GitHub::new(&base, token)?;
    let string = |i: usize| {
        args.get(i)
            .and_then(Value::as_str)
            .ok_or_else(|| "Invalid argument".to_owned())
    };
    match operation.as_str() {
        "profile" => client.profile().await,
        "list" => Ok(Value::Array(client.list().await?)),
        "get" => client.get(string(0)?).await,
        "create" => {
            client
                .create(
                    string(0)?,
                    args.get(1).ok_or("Missing files")?,
                    args.get(2).and_then(Value::as_bool).unwrap_or(false),
                )
                .await
        }
        "update" => {
            client
                .update(string(0)?, string(1)?, args.get(2).ok_or("Missing files")?)
                .await
        }
        "delete" => {
            client.delete(string(0)?).await?;
            Ok(Value::Null)
        }
        _ => Err("Unknown GitHub operation".into()),
    }
}

#[tauri::command]
async fn start_github_oauth(app: tauri::AppHandle) -> Result<String, String> {
    github_oauth::authorize(app).await
}

fn main() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "ui-tests")]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = match std::env::var_os("LEPTON_PROTOTYPE_DATA_DIR") {
                Some(path) => std::path::PathBuf::from(path),
                None => app.path().app_data_dir()?,
            };
            #[cfg(feature = "ui-tests")]
            if std::env::var("LEPTON_UI_TESTS").as_deref() == Ok("1")
                && (std::env::var_os("LEPTON_PROTOTYPE_DATA_DIR").is_none()
                    || directory.join("snippets.sqlite3").exists())
            {
                return Err(std::io::Error::other(
                    "UI tests require a fresh isolated data directory",
                )
                .into());
            }
            let library = Library::open(directory.clone()).map_err(std::io::Error::other)?;
            app.manage(Mutex::new(library));
            #[allow(unused_mut)]
            let mut local_gists = LocalGists::open(&directory).map_err(std::io::Error::other)?;
            #[cfg(feature = "ui-tests")]
            if std::env::var("LEPTON_UI_TESTS").as_deref() == Ok("1") {
                local_gists
                    .seed_ui_fixtures()
                    .map_err(std::io::Error::other)?;
            }
            app.manage(Mutex::new(local_gists));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_snippets,
            save_snippet,
            local_gist_request,
            gitlab_request,
            github_request,
            start_github_oauth,
            open_external
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Lepton Rust prototype");
}
