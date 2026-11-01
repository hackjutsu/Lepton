//! A separate, account-scoped snapshot of remote snippets. Credentials are never stored here.
use crate::credentials::{scope, Account};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;

pub struct RemoteCache {
    db: Connection,
}
impl RemoteCache {
    pub fn open(directory: &Path) -> Result<Self, String> {
        let db = Connection::open(directory.join("snippets.sqlite3"))
            .map_err(|_| "Unable to open remote cache")?;
        db.busy_timeout(Duration::from_secs(5))
            .map_err(|_| "Unable to open remote cache")?;
        db.execute_batch("CREATE TABLE IF NOT EXISTS remote_cache_accounts (scope TEXT PRIMARY KEY, profile TEXT NOT NULL, synced_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS remote_cache_gists (scope TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(scope,id));").map_err(|_| "Unable to initialize remote cache")?;
        Ok(Self { db })
    }
    pub fn replace(
        &mut self,
        account: &Account,
        profile: &Value,
        snippets: &[Value],
        synced_at: &str,
    ) -> Result<(), String> {
        let key = scope(account)?;
        let user = profile.as_object().ok_or("Invalid cached profile")?;
        let mut safe_profile = serde_json::Map::new();
        for field in [
            "login",
            "avatar_url",
            "html_url",
            "starred_url",
            "storageKey",
            "providerType",
        ] {
            if let Some(value) = user.get(field) {
                if value.is_string() || value.is_null() {
                    safe_profile.insert(field.to_owned(), value.clone());
                }
            }
        }
        if safe_profile.get("login").and_then(Value::as_str) != Some(account.login.as_str()) {
            return Err("Invalid cached profile".into());
        }
        let tx = self
            .db
            .transaction()
            .map_err(|_| "Unable to update remote cache")?;
        tx.execute("INSERT OR REPLACE INTO remote_cache_accounts(scope,profile,synced_at) VALUES (?1,?2,?3)", params![key, Value::Object(safe_profile).to_string(), synced_at]).map_err(|_| "Unable to update remote cache")?;
        tx.execute("DELETE FROM remote_cache_gists WHERE scope=?1", [&key])
            .map_err(|_| "Unable to update remote cache")?;
        for (position, gist) in snippets.iter().enumerate() {
            let id = gist
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
                .ok_or("Invalid cached snippet")?;
            if !gist.get("files").is_some_and(Value::is_object) {
                return Err("Invalid cached snippet".into());
            }
            tx.execute(
                "INSERT INTO remote_cache_gists(scope,id,position,payload) VALUES (?1,?2,?3,?4)",
                params![key, id, position as i64, gist.to_string()],
            )
            .map_err(|_| "Unable to update remote cache")?;
        }
        tx.commit()
            .map_err(|_| "Unable to update remote cache".to_owned())
    }
    pub fn load(&self, account: &Account) -> Result<Option<Value>, String> {
        let key = scope(account)?;
        let metadata: Option<(String, String)> = self
            .db
            .query_row(
                "SELECT profile,synced_at FROM remote_cache_accounts WHERE scope=?1",
                [&key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|_| "Unable to read remote cache")?;
        let Some((profile, synced_at)) = metadata else {
            return Ok(None);
        };
        let mut statement = self
            .db
            .prepare("SELECT payload FROM remote_cache_gists WHERE scope=?1 ORDER BY position ASC")
            .map_err(|_| "Unable to read remote cache")?;
        let rows = statement
            .query_map([key], |row| row.get::<_, String>(0))
            .map_err(|_| "Unable to read remote cache")?;
        let mut snippets = Vec::new();
        for row in rows {
            snippets.push(
                serde_json::from_str::<Value>(&row.map_err(|_| "Unable to read remote cache")?)
                    .map_err(|_| "Invalid remote cache")?,
            );
        }
        Ok(Some(
            json!({"profile":serde_json::from_str::<Value>(&profile).map_err(|_| "Invalid remote cache")?, "snippets":snippets, "syncedAt":synced_at}),
        ))
    }
    pub fn upsert(&mut self, account: &Account, gist: &Value) -> Result<(), String> {
        let key = scope(account)?;
        let id = gist
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
            .ok_or("Invalid cached snippet")?;
        if !gist.get("files").is_some_and(Value::is_object) {
            return Err("Invalid cached snippet".into());
        }
        let tx = self
            .db
            .transaction()
            .map_err(|_| "Unable to update remote cache")?;
        let exists: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM remote_cache_accounts WHERE scope=?1)",
                [&key],
                |row| row.get(0),
            )
            .map_err(|_| "Unable to update remote cache")?;
        if exists {
            tx.execute("INSERT INTO remote_cache_gists(scope,id,position,payload) VALUES (?1,?2,COALESCE((SELECT MIN(position)-1 FROM remote_cache_gists WHERE scope=?1),0),?3) ON CONFLICT(scope,id) DO UPDATE SET payload=excluded.payload", params![key,id,gist.to_string()]).map_err(|_| "Unable to update remote cache")?;
        }
        tx.commit()
            .map_err(|_| "Unable to update remote cache".to_owned())
    }
    pub fn delete(&self, account: &Account, id: &str) -> Result<(), String> {
        if id.is_empty() {
            return Err("Invalid cached snippet".into());
        }
        let key = scope(account)?;
        self.db
            .execute(
                "DELETE FROM remote_cache_gists WHERE scope=?1 AND id=?2",
                params![key, id],
            )
            .map_err(|_| "Unable to update remote cache")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn account(login: &str) -> Account {
        Account {
            provider: "github".into(),
            base: "https://github.com".into(),
            login: login.into(),
        }
    }
    #[test]
    fn snapshots_are_account_scoped_transactional_and_track_mutations() {
        let dir = tempfile::tempdir().unwrap();
        let mut cache = RemoteCache::open(dir.path()).unwrap();
        let user = account("octocat");
        let profile = json!({"login":"octocat", "avatar_url":"https://example.test/avatar", "token":"never-store-this"});
        let a = json!({"id":"a", "files":{"a.txt":{"content":"one"}}});
        let b = json!({"id":"b", "files":{"b.txt":{"content":"two"}}});
        cache
            .replace(&user, &profile, &[a.clone(), b.clone()], "time")
            .unwrap();
        let saved = cache.load(&user).unwrap().unwrap();
        assert_eq!(saved["snippets"], json!([a, b]));
        assert!(!saved.to_string().contains("never-store-this"));
        assert!(cache.load(&account("other")).unwrap().is_none());
        assert!(cache
            .replace(&user, &profile, &[json!({"id":"bad"})], "new")
            .is_err());
        assert_eq!(
            cache.load(&user).unwrap().unwrap()["snippets"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        cache
            .upsert(
                &user,
                &json!({"id":"a","files":{"a.txt":{"content":"updated"}}}),
            )
            .unwrap();
        cache.delete(&user, "b").unwrap();
        assert_eq!(
            cache.load(&user).unwrap().unwrap()["snippets"][0]["files"]["a.txt"]["content"],
            "updated"
        );
    }
}
