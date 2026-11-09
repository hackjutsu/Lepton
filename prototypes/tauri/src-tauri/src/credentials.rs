//! Session credentials live in the operating-system credential store, not files.
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

const SERVICE: &str = "io.lepton.rust-prototype";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct Account {
    pub provider: String,
    pub base: String,
    pub login: String,
}
#[derive(Serialize)]
pub struct RestoredAccount {
    #[serde(flatten)]
    pub account: Account,
    pub token: String,
}

trait SecretStore: Send + Sync {
    fn put(&self, account: &str, token: &str) -> Result<(), String>;
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn remove(&self, account: &str) -> Result<(), String>;
}
struct SystemStore;
struct FileStore(PathBuf);
impl FileStore {
    fn path(&self, key: &str) -> Result<PathBuf, String> {
        if key.len() != 64 || !key.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Invalid credential key".into());
        }
        Ok(self.0.join(key))
    }
}
impl SecretStore for FileStore {
    fn put(&self, key: &str, token: &str) -> Result<(), String> {
        let path = self.path(key)?;
        std::fs::create_dir_all(&self.0).map_err(|_| "Unable to save credential")?;
        let mut file =
            tempfile::NamedTempFile::new_in(&self.0).map_err(|_| "Unable to save credential")?;
        file.write_all(token.as_bytes())
            .map_err(|_| "Unable to save credential")?;
        file.persist(path)
            .map_err(|_| "Unable to save credential")?;
        Ok(())
    }
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        match std::fs::read_to_string(self.path(key)?) {
            Ok(token) => Ok(Some(token)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err("Unable to read credential".into()),
        }
    }
    fn remove(&self, key: &str) -> Result<(), String> {
        match std::fs::remove_file(self.path(key)?) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err("Unable to remove credential".into()),
        }
    }
}
#[cfg(feature = "ui-tests")]
#[derive(Default)]
struct UiTestStore(Mutex<std::collections::HashMap<String, String>>);
#[cfg(feature = "ui-tests")]
impl SecretStore for UiTestStore {
    fn put(&self, key: &str, token: &str) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|_| "Test credential store unavailable")?
            .insert(key.into(), token.into());
        Ok(())
    }
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        Ok(self
            .0
            .lock()
            .map_err(|_| "Test credential store unavailable")?
            .get(key)
            .cloned())
    }
    fn remove(&self, key: &str) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|_| "Test credential store unavailable")?
            .remove(key);
        Ok(())
    }
}
impl SecretStore for SystemStore {
    fn put(&self, account: &str, token: &str) -> Result<(), String> {
        keyring::Entry::new(SERVICE, account)
            .and_then(|entry| entry.set_password(token))
            .map_err(|_| "Secure credential storage is unavailable".into())
    }
    fn get(&self, account: &str) -> Result<Option<String>, String> {
        match keyring::Entry::new(SERVICE, account).and_then(|entry| entry.get_password()) {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("Secure credential storage is unavailable".into()),
        }
    }
    fn remove(&self, account: &str) -> Result<(), String> {
        match keyring::Entry::new(SERVICE, account).and_then(|entry| entry.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Unable to remove saved credential".into()),
        }
    }
}

pub(crate) fn scope(account: &Account) -> Result<String, String> {
    if !matches!(account.provider.as_str(), "github" | "gitlab")
        || account.login.trim().is_empty()
        || account.login.len() > 200
        || account.login.chars().any(char::is_control)
    {
        return Err("Invalid account".into());
    }
    let url = Url::parse(&account.base).map_err(|_| "Invalid account")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Invalid account".into());
    }
    let digest = Sha256::digest(
        format!("{}\0{}\0{}", account.provider, account.base, account.login).as_bytes(),
    );
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

pub struct Credentials {
    metadata: PathBuf,
    store: Box<dyn SecretStore>,
    file_store: FileStore,
    test_mode: bool,
    lock: Mutex<()>,
}
impl Credentials {
    pub fn new(directory: PathBuf, test_mode: bool) -> Self {
        #[cfg(feature = "ui-tests")]
        let store: Box<dyn SecretStore> = if test_mode {
            Box::new(UiTestStore::default())
        } else {
            Box::new(SystemStore)
        };
        #[cfg(not(feature = "ui-tests"))]
        let store: Box<dyn SecretStore> = {
            let _ = test_mode;
            Box::new(SystemStore)
        };
        Self {
            metadata: directory.join("remote-account.json"),
            store,
            file_store: FileStore(directory.join("credentials")),
            test_mode,
            lock: Mutex::new(()),
        }
    }
    #[cfg(test)]
    fn remember_with(
        &self,
        store: &dyn SecretStore,
        account: &Account,
        token: &str,
    ) -> Result<bool, String> {
        self.remember_in(store, account, token, None)
    }
    fn remember_in(
        &self,
        store: &dyn SecretStore,
        account: &Account,
        token: &str,
        storage: Option<&str>,
    ) -> Result<bool, String> {
        let key = scope(account)?;
        if token.is_empty() || token.len() > 16_384 || token.chars().any(char::is_control) {
            return Err("Invalid credential".into());
        }
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Credential storage is unavailable")?;
        let parent = self
            .metadata
            .parent()
            .ok_or("Invalid account storage path")?;
        let mut file = tempfile::NamedTempFile::new_in(parent)
            .map_err(|_| "Unable to save account information")?;
        let mut metadata =
            serde_json::to_value(account).map_err(|_| "Unable to save account information")?;
        if let Some(storage) = storage {
            metadata["storage"] = storage.into();
        }
        serde_json::to_writer(&mut file, &metadata)
            .map_err(|_| "Unable to save account information")?;
        let previous = store.get(&key)?;
        store.put(&key, token)?;
        if file.persist(&self.metadata).is_err() {
            if let Some(previous) = previous {
                let _ = store.put(&key, &previous);
            } else {
                let _ = store.remove(&key);
            }
            return Err("Unable to save account information".into());
        }
        Ok(true)
    }
    fn restore_with(&self, store: &dyn SecretStore) -> Result<Option<RestoredAccount>, String> {
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Credential storage is unavailable")?;
        let bytes = match std::fs::read(&self.metadata) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err("Unable to read account information".into()),
        };
        let account: Account =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid account information")?;
        let key = scope(&account)?;
        Ok(store
            .get(&key)?
            .map(|token| RestoredAccount { account, token }))
    }
    fn forget_with(&self, store: &dyn SecretStore, account: &Account) -> Result<(), String> {
        let key = scope(account)?;
        let _guard = self
            .lock
            .lock()
            .map_err(|_| "Credential storage is unavailable")?;
        let existing = match std::fs::read(&self.metadata) {
            Ok(bytes) => Some(
                serde_json::from_slice::<Account>(&bytes)
                    .map_err(|_| "Invalid account information")?,
            ),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(_) => return Err("Unable to read account information".into()),
        };
        if existing.as_ref() == Some(account) {
            std::fs::remove_file(&self.metadata)
                .map_err(|_| "Unable to remove account information")?;
        }
        store.remove(&key)
    }
    #[cfg(all(test, feature = "ui-tests"))]
    pub fn remember(&self, account: &Account, token: &str) -> Result<bool, String> {
        self.remember_with(self.store.as_ref(), account, token)
    }
    #[cfg(all(test, feature = "ui-tests"))]
    pub fn restore(&self) -> Result<Option<RestoredAccount>, String> {
        self.restore_with(self.store.as_ref())
    }
    #[cfg(all(test, feature = "ui-tests"))]
    pub fn forget(&self, account: &Account) -> Result<(), String> {
        self.forget_with(self.store.as_ref(), account)
    }

    fn development_file_storage(&self) -> bool {
        cfg!(debug_assertions) && !self.test_mode
    }

    fn file_mode(&self, mode: &str) -> bool {
        mode == "file" || self.development_file_storage()
    }

    fn stores_for(&self, mode: &str) -> (&dyn SecretStore, &dyn SecretStore) {
        if self.file_mode(mode) {
            (&self.file_store, self.store.as_ref())
        } else {
            (self.store.as_ref(), &self.file_store)
        }
    }

    pub fn remember_configured(
        &self,
        account: &Account,
        token: &str,
        mode: &str,
    ) -> Result<(bool, bool), String> {
        if self.development_file_storage() {
            return self
                .remember_in(&self.file_store, account, token, Some("file"))
                .map(|saved| (saved, false));
        }
        let (selected, previous) = self.stores_for(mode);
        let file_mode = self.file_mode(mode);
        let saved = self.remember_in(
            selected,
            account,
            token,
            Some(if file_mode { "file" } else { "encrypted" }),
        );
        let (result, fallback) = match saved {
            Err(error) if !file_mode && error == "Secure credential storage is unavailable" => (
                self.remember_in(&self.file_store, account, token, Some("file"))?,
                true,
            ),
            other => (other?, false),
        };
        if !fallback {
            match previous.remove(&scope(account)?) {
                Ok(()) => {}
                Err(error) if file_mode && error == "Secure credential storage is unavailable" => {}
                Err(error) => return Err(error),
            }
        }
        Ok((result, fallback))
    }

    pub fn restore_configured(
        &self,
        mode: &str,
    ) -> Result<(Option<RestoredAccount>, bool), String> {
        if self.development_file_storage() {
            return self
                .restore_with(&self.file_store)
                .map(|account| (account, false));
        }
        let (selected, previous) = self.stores_for(mode);
        let metadata = match std::fs::read(&self.metadata) {
            Ok(bytes) => serde_json::from_slice::<serde_json::Value>(&bytes)
                .map_err(|_| "Invalid account information")?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok((None, false)),
            Err(_) => return Err("Unable to read account information".into()),
        };
        let saved_file =
            metadata.get("storage").and_then(serde_json::Value::as_str) == Some("file");
        let selected_is_saved = saved_file == self.file_mode(mode);
        let saved_store = if selected_is_saved {
            selected
        } else {
            previous
        };
        let Some(account) = self.restore_with(saved_store)? else {
            return Ok((None, false));
        };
        if selected_is_saved {
            return Ok((Some(account), saved_file && !self.file_mode(mode)));
        }
        match self.remember_configured(&account.account, &account.token, mode) {
            Ok((_, fallback)) => Ok((Some(account), fallback)),
            Err(error) => Err(error),
        }
    }

    pub fn forget_configured(&self, account: &Account, mode: &str) -> Result<(), String> {
        if self.development_file_storage() {
            return self.forget_with(&self.file_store, account);
        }
        let saved_file = match std::fs::read(&self.metadata) {
            Ok(bytes) => {
                serde_json::from_slice::<serde_json::Value>(&bytes)
                    .map_err(|_| "Invalid account information")?
                    .get("storage")
                    .and_then(serde_json::Value::as_str)
                    == Some("file")
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => self.file_mode(mode),
            Err(_) => return Err("Unable to read account information".into()),
        };
        let (stored, other): (&dyn SecretStore, &dyn SecretStore) = if saved_file {
            (&self.file_store, self.store.as_ref())
        } else {
            (self.store.as_ref(), &self.file_store)
        };
        self.forget_with(stored, account)?;
        other.remove(&scope(account)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    struct NoKeychain;
    impl SecretStore for NoKeychain {
        fn put(&self, _: &str, _: &str) -> Result<(), String> {
            panic!("Keychain write")
        }
        fn get(&self, _: &str) -> Result<Option<String>, String> {
            panic!("Keychain read")
        }
        fn remove(&self, _: &str) -> Result<(), String> {
            panic!("Keychain cleanup")
        }
    }
    #[cfg(debug_assertions)]
    #[test]
    fn development_files_persist_without_keychain_access() {
        let dir = tempfile::tempdir().unwrap();
        let account = Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: "test-account".into(),
        };
        for mode in ["auto", "file", "encrypted"] {
            let mut credentials = Credentials::new(dir.path().into(), false);
            credentials.store = Box::new(NoKeychain);
            assert!(credentials.restore_configured(mode).unwrap().0.is_none());
            credentials
                .remember_configured(&account, "dedicated-test-token", mode)
                .unwrap();
            let mut restarted = Credentials::new(dir.path().into(), false);
            restarted.store = Box::new(NoKeychain);
            assert_eq!(
                restarted.restore_configured(mode).unwrap().0.unwrap().token,
                "dedicated-test-token"
            );
            restarted.forget_configured(&account, mode).unwrap();
            assert!(restarted.restore_configured(mode).unwrap().0.is_none());
        }
    }

    #[derive(Default)]
    struct Mock(Mutex<HashMap<String, String>>);
    struct Unavailable;
    impl SecretStore for Unavailable {
        fn put(&self, _: &str, _: &str) -> Result<(), String> {
            Err("Secure credential storage is unavailable".into())
        }
        fn get(&self, _: &str) -> Result<Option<String>, String> {
            Err("Secure credential storage is unavailable".into())
        }
        fn remove(&self, _: &str) -> Result<(), String> {
            Err("Secure credential storage is unavailable".into())
        }
    }
    impl SecretStore for Mock {
        fn put(&self, key: &str, token: &str) -> Result<(), String> {
            self.0.lock().unwrap().insert(key.into(), token.into());
            Ok(())
        }
        fn get(&self, key: &str) -> Result<Option<String>, String> {
            Ok(self.0.lock().unwrap().get(key).cloned())
        }
        fn remove(&self, key: &str) -> Result<(), String> {
            self.0.lock().unwrap().remove(key);
            Ok(())
        }
    }
    #[test]
    fn keeps_tokens_out_of_metadata_and_removes_them_on_logout() {
        let dir = tempfile::tempdir().unwrap();
        let store = Credentials::new(dir.path().into(), false);
        let backend = Mock::default();
        let account = Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: "octocat".into(),
        };
        assert!(store
            .remember_with(&backend, &account, "secret-for-test")
            .unwrap());
        let metadata = std::fs::read_to_string(&store.metadata).unwrap();
        assert!(!metadata.contains("secret-for-test"));
        let restored = store.restore_with(&backend).unwrap().unwrap();
        assert_eq!(restored.account, account);
        assert_eq!(restored.token, "secret-for-test");
        let other = Account {
            base: "https://enterprise.example".into(),
            ..account.clone()
        };
        assert_ne!(scope(&other).unwrap(), scope(&account).unwrap());
        store.forget_with(&backend, &account).unwrap();
        assert!(store.restore_with(&backend).unwrap().is_none());
        assert!(backend.0.lock().unwrap().is_empty());
    }
    #[test]
    fn invalid_accounts_never_write_secrets() {
        let dir = tempfile::tempdir().unwrap();
        let backend = Mock::default();
        let account = Account {
            provider: "github".into(),
            base: "https://user:password@example.com".into(),
            login: "octocat".into(),
        };
        assert!(Credentials::new(dir.path().into(), false)
            .remember_with(&backend, &account, "test")
            .is_err());
        assert!(backend.0.lock().unwrap().is_empty());
    }
    #[test]
    fn configured_storage_moves_credentials_between_file_and_secure_store() {
        let dir = tempfile::tempdir().unwrap();
        let mut credentials = Credentials::new(dir.path().into(), true);
        credentials.store = Box::new(Mock::default());
        let account = Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: "octocat".into(),
        };
        let key = scope(&account).unwrap();
        credentials
            .remember_configured(&account, "test-only", "encrypted")
            .unwrap();
        assert!(credentials.file_store.get(&key).unwrap().is_none());
        assert_eq!(
            credentials
                .restore_configured("file")
                .unwrap()
                .0
                .unwrap()
                .token,
            "test-only"
        );
        assert_eq!(
            credentials.file_store.get(&key).unwrap().as_deref(),
            Some("test-only")
        );
        assert!(credentials.store.get(&key).unwrap().is_none());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(credentials.file_store.path(&key).unwrap())
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o077,
                0
            );
        }
        assert_eq!(
            credentials
                .restore_configured("encrypted")
                .unwrap()
                .0
                .unwrap()
                .token,
            "test-only"
        );
        assert!(credentials.file_store.get(&key).unwrap().is_none());
        credentials
            .forget_configured(&account, "encrypted")
            .unwrap();
        assert!(credentials
            .restore_configured("encrypted")
            .unwrap()
            .0
            .is_none());
    }
    #[test]
    fn encrypted_mode_falls_back_and_recovers_when_native_storage_returns() {
        let dir = tempfile::tempdir().unwrap();
        let mut credentials = Credentials::new(dir.path().into(), true);
        credentials.store = Box::new(Unavailable);
        let account = Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: "octocat".into(),
        };
        let key = scope(&account).unwrap();
        assert_eq!(
            credentials
                .remember_configured(&account, "test-only", "encrypted")
                .unwrap(),
            (true, true)
        );
        assert_eq!(
            credentials
                .restore_configured("encrypted")
                .unwrap()
                .0
                .unwrap()
                .token,
            "test-only"
        );
        assert_eq!(
            credentials.file_store.get(&key).unwrap().as_deref(),
            Some("test-only")
        );
        credentials.store = Box::new(Mock::default());
        let (restored, fallback) = credentials.restore_configured("encrypted").unwrap();
        assert!(!fallback);
        assert_eq!(restored.unwrap().token, "test-only");
        assert!(credentials.file_store.get(&key).unwrap().is_none());
    }
    #[test]
    fn logout_removes_the_fallback_file_even_if_secure_storage_is_unavailable() {
        let dir = tempfile::tempdir().unwrap();
        let mut credentials = Credentials::new(dir.path().into(), true);
        credentials.store = Box::new(Unavailable);
        let account = Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: "octocat".into(),
        };
        let key = scope(&account).unwrap();
        credentials
            .remember_configured(&account, "test-only", "encrypted")
            .unwrap();
        assert!(credentials
            .forget_configured(&account, "encrypted")
            .is_err());
        assert!(credentials.file_store.get(&key).unwrap().is_none());
        assert!(!credentials.metadata.exists());
    }
    #[cfg(feature = "ui-tests")]
    #[test]
    fn ui_test_store_keeps_tokens_out_of_files() {
        let dir = tempfile::tempdir().unwrap();
        let store = Credentials::new(dir.path().into(), true);
        let account = Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: "test".into(),
        };
        assert!(store.remember(&account, "test-only-secret").unwrap());
        assert!(!std::fs::read_to_string(&store.metadata)
            .unwrap()
            .contains("test-only-secret"));
        assert_eq!(store.restore().unwrap().unwrap().token, "test-only-secret");
        store.forget(&account).unwrap();
        assert!(store.restore().unwrap().is_none());
    }

    #[test]
    #[ignore = "requires an unlocked native credential store"]
    fn native_store_round_trip_uses_a_disposable_entry() {
        let key = format!("lepton-test-{}", uuid::Uuid::new_v4());
        let store = SystemStore;
        store
            .put(&key, "test-only-credential")
            .expect("store disposable credential");
        let result = store.get(&key);
        let cleanup = store.remove(&key);
        assert_eq!(result.unwrap().as_deref(), Some("test-only-credential"));
        cleanup.expect("remove disposable credential");
        assert!(store.get(&key).unwrap().is_none());
    }
}
