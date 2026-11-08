#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod credentials;
mod github;
mod github_oauth;
mod gitlab;
mod http_client;
mod library;
mod local_gists;
mod remote_cache;
mod runtime;
mod tray;

use library::{Draft, Library, Snippet};
use local_gists::LocalGists;
use serde_json::Value;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

struct StartupGithubTokenFile(Mutex<Option<std::ffi::OsString>>);
struct TestAutostart(Mutex<bool>);

#[cfg(feature = "ui-tests")]
#[tauri::command]
fn ui_test_window_action(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    autostart: tauri::State<'_, TestAutostart>,
    action: String,
) -> Result<Value, String> {
    if std::env::var("LEPTON_UI_TESTS").as_deref() != Ok("1") {
        return Err("Test commands are disabled".into());
    }
    match action.as_str() {
        "close" => window.close().map_err(|_| "Unable to close test window")?,
        "minimize" => window
            .minimize()
            .map_err(|_| "Unable to minimize test window")?,
        "show" => {
            window
                .unminimize()
                .map_err(|_| "Unable to restore test window")?;
            window.show().map_err(|_| "Unable to show test window")?;
        }
        "status" => {}
        _ => return Err("Invalid test action".into()),
    }
    Ok(serde_json::json!({
        "visible": window.is_visible().map_err(|_| "Unable to check test window")?,
        "tray": app.tray_by_id("lepton-tray").is_some(),
        "autostart": *autostart.0.lock().map_err(|_| "Autostart unavailable")?
    }))
}

#[tauri::command]
fn take_startup_github_token(
    state: tauri::State<'_, StartupGithubTokenFile>,
) -> Result<Option<String>, String> {
    let path = state
        .0
        .lock()
        .map_err(|_| "Unable to read startup credential")?
        .take();
    let Some(path) = path else { return Ok(None) };
    let token = std::fs::read_to_string(path).map_err(|_| "Unable to read startup credential")?;
    let token = token.trim();
    if token.is_empty() {
        return Err("Startup credential is empty".into());
    }
    Ok(Some(token.to_owned()))
}

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

#[tauri::command]
fn set_webview_zoom(window: tauri::WebviewWindow, percent: f64) -> Result<(), String> {
    if !percent.is_finite() || !(50.0..=300.0).contains(&percent) {
        return Err("Invalid zoom percentage".into());
    }
    window
        .set_zoom(percent / 100.0)
        .map_err(|_| "Unable to apply zoom".into())
}

#[tauri::command]
fn show_native_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    if title.len() > 512 || body.len() > 4096 {
        return Err("Notification is too long".into());
    }
    if cfg!(feature = "ui-tests") && std::env::var("LEPTON_UI_TESTS").as_deref() == Ok("1") {
        return Ok(());
    }
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|_| "Unable to show notification".into())
}

#[tauri::command]
fn runtime_info(files: tauri::State<'_, runtime::RuntimeFiles>) -> Result<Value, String> {
    files.info()
}

fn apply_startup_autostart(
    app: &tauri::AppHandle,
    files: &runtime::RuntimeFiles,
    test_mode: bool,
) -> Result<(), String> {
    let enabled = files
        .info()?
        .get("config")
        .and_then(|config| config.get("startAtLogin"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if test_mode {
        let state = app.state::<TestAutostart>();
        *state.0.lock().map_err(|_| "Autostart unavailable")? = enabled;
        return Ok(());
    }
    let manager = app.autolaunch();
    let current = manager
        .is_enabled()
        .map_err(|_| "Unable to check start at login")?;
    if current != enabled {
        if enabled {
            manager.enable()
        } else {
            manager.disable()
        }
        .map_err(|_| "Unable to apply start at login")?;
    }
    Ok(())
}

#[tauri::command]
fn set_runtime_config(
    app: tauri::AppHandle,
    files: tauri::State<'_, runtime::RuntimeFiles>,
    test_autostart: tauri::State<'_, TestAutostart>,
    key: String,
    value: Value,
) -> Result<Value, String> {
    if key == "startAtLogin" {
        let enabled = value.as_bool().ok_or("Invalid autostart preference")?;
        if cfg!(feature = "ui-tests") && std::env::var("LEPTON_UI_TESTS").as_deref() == Ok("1") {
            let mut current = test_autostart
                .0
                .lock()
                .map_err(|_| "Autostart unavailable")?;
            let saved = files.set(&key, value)?;
            *current = enabled;
            return Ok(saved);
        }
        let manager = app.autolaunch();
        let previous = manager
            .is_enabled()
            .map_err(|_| "Unable to check start at login")?;
        if enabled {
            manager.enable()
        } else {
            manager.disable()
        }
        .map_err(|_| "Unable to change start at login")?;
        match files.set(&key, value) {
            Ok(saved) => return Ok(saved),
            Err(error) => {
                if previous {
                    let _ = manager.enable();
                } else {
                    let _ = manager.disable();
                }
                return Err(error);
            }
        }
    }
    files.set(&key, value)
}

#[tauri::command]
fn ensure_runtime_config(
    files: tauri::State<'_, runtime::RuntimeFiles>,
    defaults: Value,
) -> Result<(), String> {
    files.ensure(&defaults)
}

#[tauri::command]
fn log_runtime_event(
    files: tauri::State<'_, runtime::RuntimeFiles>,
    level: String,
    message: String,
) {
    files.log_event(&level, &message);
}

#[tauri::command]
fn open_runtime_file(
    app: tauri::AppHandle,
    files: tauri::State<'_, runtime::RuntimeFiles>,
    path: String,
) -> Result<(), String> {
    if std::path::Path::new(&path) != files.config && std::path::Path::new(&path) != files.log {
        return Err("Invalid file path".into());
    }
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|_| "Unable to open file".into())
}

#[tauri::command]
async fn remember_remote_account(
    store: tauri::State<'_, Arc<credentials::Credentials>>,
    files: tauri::State<'_, runtime::RuntimeFiles>,
    account: credentials::Account,
    token: String,
) -> Result<bool, String> {
    let mode = files.token_storage_mode()?;
    let store = Arc::clone(store.inner());
    let (saved, fallback) = tauri::async_runtime::spawn_blocking(move || {
        store.remember_configured(&account, &token, &mode)
    })
    .await
    .map_err(|_| "Credential storage is unavailable")??;
    if fallback {
        files.log_event(
            "warn",
            "Secure credential storage unavailable; using file storage",
        );
    }
    Ok(saved)
}

#[tauri::command]
async fn restore_remote_account(
    store: tauri::State<'_, Arc<credentials::Credentials>>,
    files: tauri::State<'_, runtime::RuntimeFiles>,
) -> Result<Option<credentials::RestoredAccount>, String> {
    let mode = files.token_storage_mode()?;
    let store = Arc::clone(store.inner());
    let (account, fallback) =
        tauri::async_runtime::spawn_blocking(move || store.restore_configured(&mode))
            .await
            .map_err(|_| "Credential storage is unavailable")??;
    if fallback {
        files.log_event(
            "warn",
            "Secure credential storage unavailable; using file storage",
        );
    }
    Ok(account)
}

#[tauri::command]
async fn forget_remote_account(
    store: tauri::State<'_, Arc<credentials::Credentials>>,
    files: tauri::State<'_, runtime::RuntimeFiles>,
    account: credentials::Account,
) -> Result<(), String> {
    let mode = files.token_storage_mode()?;
    let store = Arc::clone(store.inner());
    tauri::async_runtime::spawn_blocking(move || store.forget_configured(&account, &mode))
        .await
        .map_err(|_| "Credential storage is unavailable")?
}

#[tauri::command]
async fn save_remote_cache(
    cache: tauri::State<'_, Arc<Mutex<remote_cache::RemoteCache>>>,
    account: credentials::Account,
    profile: Value,
    snippets: Vec<Value>,
    synced_at: String,
) -> Result<(), String> {
    let cache = Arc::clone(cache.inner());
    tauri::async_runtime::spawn_blocking(move || {
        cache
            .lock()
            .map_err(|_| "Remote cache unavailable")?
            .replace(&account, &profile, &snippets, &synced_at)
    })
    .await
    .map_err(|_| "Remote cache unavailable")?
}

#[tauri::command]
async fn load_remote_cache(
    cache: tauri::State<'_, Arc<Mutex<remote_cache::RemoteCache>>>,
    account: credentials::Account,
) -> Result<Option<Value>, String> {
    let cache = Arc::clone(cache.inner());
    tauri::async_runtime::spawn_blocking(move || {
        cache
            .lock()
            .map_err(|_| "Remote cache unavailable")?
            .load(&account)
    })
    .await
    .map_err(|_| "Remote cache unavailable")?
}

#[tauri::command]
async fn update_remote_cache(
    cache: tauri::State<'_, Arc<Mutex<remote_cache::RemoteCache>>>,
    account: credentials::Account,
    gist: Value,
) -> Result<(), String> {
    let cache = Arc::clone(cache.inner());
    tauri::async_runtime::spawn_blocking(move || {
        cache
            .lock()
            .map_err(|_| "Remote cache unavailable")?
            .upsert(&account, &gist)
    })
    .await
    .map_err(|_| "Remote cache unavailable")?
}

#[tauri::command]
async fn delete_remote_cache(
    cache: tauri::State<'_, Arc<Mutex<remote_cache::RemoteCache>>>,
    account: credentials::Account,
    id: String,
) -> Result<(), String> {
    let cache = Arc::clone(cache.inner());
    tauri::async_runtime::spawn_blocking(move || {
        cache
            .lock()
            .map_err(|_| "Remote cache unavailable")?
            .delete(&account, &id)
    })
    .await
    .map_err(|_| "Remote cache unavailable")?
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
    proxy: Option<String>,
) -> Result<Value, String> {
    let client = gitlab::GitLab::new_with_proxy(&base, token, proxy.as_deref())?;
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
    proxy: Option<String>,
) -> Result<Value, String> {
    let client = github::GitHub::new_with_proxy(&base, token, proxy.as_deref())?;
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
        .on_window_event(tray::on_window_event)
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .manage(TestAutostart(Mutex::new(false)))
        .manage(StartupGithubTokenFile(Mutex::new(std::env::var_os(
            "LEPTON_GITHUB_TOKEN_FILE",
        ))))
        .setup(|app| {
            let dev_keychain_free = cfg!(debug_assertions)
                && std::env::var("LEPTON_DEV_KEYCHAIN_FREE").as_deref() == Ok("1");
            let directory = match std::env::var_os("LEPTON_PROTOTYPE_DATA_DIR") {
                Some(path) => std::path::PathBuf::from(path),
                None => app.path().app_data_dir()?,
            };
            let directory = if dev_keychain_free {
                directory.join("keychain-free-development")
            } else {
                directory
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
            app.manage(Arc::new(Mutex::new(
                remote_cache::RemoteCache::open(&directory).map_err(std::io::Error::other)?,
            )));
            let test_credentials = cfg!(feature = "ui-tests")
                && std::env::var("LEPTON_UI_TESTS").as_deref() == Ok("1");
            let credential_store =
                credentials::Credentials::new(directory.clone(), test_credentials);
            #[cfg(debug_assertions)]
            let credential_store = if dev_keychain_free {
                credentials::Credentials::development(directory.clone())
            } else {
                credential_store
            };
            app.manage(Arc::new(credential_store));
            let config_path = runtime::config_path(
                &app.path().home_dir()?,
                (test_credentials || dev_keychain_free).then_some(directory.as_path()),
            );
            let runtime_files = runtime::RuntimeFiles::new(config_path, &directory)
                .map_err(std::io::Error::other)?;
            if let Err(error) = apply_startup_autostart(
                app.handle(),
                &runtime_files,
                test_credentials || dev_keychain_free,
            ) {
                runtime_files.log_event("warn", &error);
            }
            app.manage(runtime_files);
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
            #[cfg(feature = "ui-tests")]
            ui_test_window_action,
            search_snippets,
            save_snippet,
            local_gist_request,
            gitlab_request,
            github_request,
            start_github_oauth,
            open_external,
            set_webview_zoom,
            show_native_notification,
            take_startup_github_token,
            runtime_info,
            set_runtime_config,
            ensure_runtime_config,
            open_runtime_file,
            log_runtime_event,
            remember_remote_account,
            restore_remote_account,
            forget_remote_account,
            save_remote_cache,
            load_remote_cache,
            update_remote_cache,
            delete_remote_cache
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Lepton Rust prototype");
}
