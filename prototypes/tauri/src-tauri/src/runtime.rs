//! Prototype configuration and log paths. Only known preferences cross the bridge.
use serde_json::{json, Map, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct RuntimeFiles {
    pub config: PathBuf,
    pub log: PathBuf,
    lock: Mutex<()>,
}

const KEYS: &[&str] = &[
    "theme",
    "autoUpdate",
    "startAtLogin",
    "i18n:locale",
    "window:closeToTray",
    "window:minimizeToTray",
    "avatar:type",
    "avatar:boringAvatarVariant",
    "userPanel:hideProfilePhoto",
    "logger:level",
    "security:cachedAccessTokenStorage",
    "provider:type",
    "gitlab:host",
    "proxy:enable",
    "proxy:address",
    "snippet:sorting",
    "snippet:sortingReverse",
    "snippet:expanded",
    "snippet:newSnippetPrivate",
    "snippet:downloadAll",
    "tag:showInSnippetList",
    "tag:colored",
    "editor:tabSize",
    "editor:validateFilename",
    "editor:imageMaxSizeKB",
    "enterprise:enable",
    "enterprise:host",
    "enterprise:avatarUrl",
    "notifications:success",
    "notifications:failure",
    "zoom:percent",
    "shortcuts:keyShortcutForSearch",
    "shortcuts:keyNewGist",
    "shortcuts:keyEditGist",
    "shortcuts:keyDeleteGist",
    "shortcuts:keySubmitGist",
    "shortcuts:keyImmersiveMode",
    "shortcuts:keyAboutPage",
    "shortcuts:keyDashboard",
    "shortcuts:keySyncGists",
];

fn get<'a>(root: &'a Value, key: &str) -> Option<&'a Value> {
    key.split(':').try_fold(root, |v, p| v.get(p))
}
fn put(root: &mut Value, key: &str, value: Value) -> Result<(), String> {
    let mut parts = key.split(':').peekable();
    let mut cursor = root;
    while let Some(part) = parts.next() {
        let object = cursor
            .as_object_mut()
            .ok_or("Invalid configuration structure")?;
        if parts.peek().is_none() {
            object.insert(part.to_owned(), value);
            return Ok(());
        }
        cursor = object
            .entry(part)
            .or_insert_with(|| Value::Object(Map::new()));
    }
    Err("Invalid configuration key".into())
}
fn read(path: &Path) -> Result<Value, String> {
    match fs::read(path) {
        Ok(bytes) => {
            let value: Value =
                serde_json::from_slice(&bytes).map_err(|_| "Invalid .leptonrc JSON")?;
            if !value.is_object() {
                return Err("Invalid .leptonrc JSON".into());
            }
            Ok(value)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(_) => Err("Unable to read .leptonrc".into()),
    }
}
impl RuntimeFiles {
    pub fn new(config: PathBuf, directory: &Path) -> Result<Self, String> {
        let log_dir = directory.join("logs");
        fs::create_dir_all(&log_dir).map_err(|_| "Unable to create log directory")?;
        let log = log_dir.join("lepton.log");
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log)
            .map_err(|_| "Unable to open log file")?;
        writeln!(file, "Lepton Rust prototype started").map_err(|_| "Unable to write log file")?;
        Ok(Self {
            config,
            log,
            lock: Mutex::new(()),
        })
    }
    pub fn info(&self) -> Result<Value, String> {
        let _guard = self.lock.lock().map_err(|_| "Configuration unavailable")?;
        let source = read(&self.config)?;
        let mut filtered = json!({});
        for key in KEYS {
            if let Some(value) = get(&source, key) {
                put(&mut filtered, key, value.clone())?;
            }
        }
        Ok(
            json!({"configFilePath":self.config.to_string_lossy(),"logFilePath":self.log.to_string_lossy(),"config":filtered}),
        )
    }
    pub fn ensure(&self, defaults: &Value) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|_| "Configuration unavailable")?;
        let mut filtered = json!({});
        for key in KEYS {
            if let Some(value) = get(defaults, key) {
                if value.is_boolean() || value.is_number() || value.is_string() {
                    put(&mut filtered, key, value.clone())?;
                }
            }
        }
        let data = serde_json::to_vec_pretty(&filtered).map_err(|_| "Invalid defaults")?;
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&self.config)
        {
            Ok(mut file) => file
                .write_all(&data)
                .map_err(|_| "Unable to write .leptonrc".to_owned()),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
            Err(_) => Err("Unable to create .leptonrc".into()),
        }
    }
    pub fn set(&self, key: &str, value: Value) -> Result<Value, String> {
        if !KEYS.contains(&key) || !(value.is_string() || value.is_boolean() || value.is_number()) {
            return Err("Invalid preference".into());
        }
        let _guard = self.lock.lock().map_err(|_| "Configuration unavailable")?;
        let mut source = read(&self.config)?;
        put(&mut source, key, value.clone())?;
        let parent = self.config.parent().ok_or("Invalid configuration path")?;
        let mut file =
            tempfile::NamedTempFile::new_in(parent).map_err(|_| "Unable to write .leptonrc")?;
        serde_json::to_writer_pretty(&mut file, &source)
            .map_err(|_| "Unable to write .leptonrc")?;
        file.persist(&self.config)
            .map_err(|_| "Unable to write .leptonrc")?;
        Ok(value)
    }
    pub fn log_event(&self, level: &str) {
        if matches!(level, "warn" | "error") {
            if let Ok(mut file) = OpenOptions::new().append(true).open(&self.log) {
                let _ = writeln!(
                    file,
                    "Renderer reported a {level}; details omitted to protect credentials"
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_private_fields_and_refuses_invalid_input() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join(".leptonrc");
        fs::write(&path, r#"{"theme":"dark","enterprise":{"token":"secret"}}"#).unwrap();
        let files = RuntimeFiles::new(path.clone(), tmp.path()).unwrap();
        let info = files.info().unwrap();
        assert_eq!(info["config"]["theme"], "dark");
        assert!(info.to_string().find("secret").is_none());
        files.set("theme", json!("light")).unwrap();
        let saved = read(&path).unwrap();
        assert_eq!(saved["enterprise"]["token"], "secret");
        assert!(files.set("enterprise:token", json!("changed")).is_err());
        fs::write(&path, "{").unwrap();
        assert!(files.set("theme", json!("dark")).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "{");
    }
}
