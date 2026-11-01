//! Session credentials live in the operating-system credential store, not files.
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
            lock: Mutex::new(()),
        }
    }
    fn remember_with(
        &self,
        store: &dyn SecretStore,
        account: &Account,
        token: &str,
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
        serde_json::to_writer(&mut file, account)
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
    pub fn remember(&self, account: &Account, token: &str) -> Result<bool, String> {
        self.remember_with(self.store.as_ref(), account, token)
    }
    pub fn restore(&self) -> Result<Option<RestoredAccount>, String> {
        self.restore_with(self.store.as_ref())
    }
    pub fn forget(&self, account: &Account) -> Result<(), String> {
        self.forget_with(self.store.as_ref(), account)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    #[derive(Default)]
    struct Mock(Mutex<HashMap<String, String>>);
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
