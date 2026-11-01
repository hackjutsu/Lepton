#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod library;
mod local_gists;

use library::{Draft, Library, Snippet};
use local_gists::LocalGists;
use serde_json::Value;
use std::sync::Mutex;
use tauri::Manager;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let directory = match std::env::var_os("LEPTON_PROTOTYPE_DATA_DIR") {
                Some(path) => std::path::PathBuf::from(path),
                None => app.path().app_data_dir()?,
            };
            let library = Library::open(directory.clone()).map_err(std::io::Error::other)?;
            app.manage(Mutex::new(library));
            let local_gists = LocalGists::open(&directory).map_err(std::io::Error::other)?;
            app.manage(Mutex::new(local_gists));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_snippets,
            save_snippet,
            local_gist_request
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Lepton Rust prototype");
}
