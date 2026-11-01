use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Map, Value};
use std::path::Path;

pub struct LocalGists {
    db: Connection,
}

pub(crate) fn language(name: &str) -> Option<&'static str> {
    match name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "rs" => Some("Rust"),
        "js" | "jsx" => Some("JavaScript"),
        "ts" | "tsx" => Some("TypeScript"),
        "py" => Some("Python"),
        "md" => Some("Markdown"),
        "sql" => Some("SQL"),
        "sh" => Some("Shell"),
        "c" | "h" => Some("C"),
        "cpp" | "cc" | "hpp" => Some("C++"),
        "cs" => Some("C#"),
        "go" => Some("Go"),
        "java" => Some("Java"),
        "php" => Some("PHP"),
        "rb" => Some("Ruby"),
        "scss" => Some("SCSS"),
        "xml" => Some("XML"),
        "yml" | "yaml" => Some("YAML"),
        "html" => Some("HTML"),
        "css" => Some("CSS"),
        "json" => Some("JSON"),
        "ipynb" => Some("Jupyter Notebook"),
        _ => None,
    }
}

impl LocalGists {
    pub fn open(directory: &Path) -> Result<Self, String> {
        let mut db =
            Connection::open(directory.join("snippets.sqlite3")).map_err(|e| e.to_string())?;
        db.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch("CREATE TABLE IF NOT EXISTS local_gists (id TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS prototype_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);").map_err(|e| e.to_string())?;
        let initialized: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM prototype_metadata WHERE key='gists_initialized')",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !initialized {
            {
                let mut stmt = tx
                    .prepare(
                        "SELECT id,title,filename,tags,content FROM snippets ORDER BY rowid ASC",
                    )
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map([], |r| {
                        Ok((
                            r.get::<_, String>(0)?,
                            r.get::<_, String>(1)?,
                            r.get::<_, String>(2)?,
                            r.get::<_, String>(3)?,
                            r.get::<_, String>(4)?,
                        ))
                    })
                    .map_err(|e| e.to_string())?;
                for row in rows {
                    let (id, title, filename, raw_tags, content) =
                        row.map_err(|e| e.to_string())?;
                    let tags: Vec<String> =
                        serde_json::from_str(&raw_tags).map_err(|e| e.to_string())?;
                    let description = format!(
                        "[{}] {}",
                        title,
                        tags.iter()
                            .map(|t| format!("#{t}"))
                            .collect::<Vec<_>>()
                            .join(" ")
                    );
                    let mut files = Map::new();
                    files.insert(filename.clone(), json!({"filename":filename,"language":language(&filename),"content":content}));
                    let gist = json!({"id":id,"description":description,"public":false,"html_url":"","updated_at":"2026-01-01T00:00:00Z","files":files});
                    tx.execute(
                        "INSERT INTO local_gists (id,payload) VALUES (?1,?2)",
                        params![id, gist.to_string()],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
            tx.execute(
                "INSERT INTO prototype_metadata (key,value) VALUES ('gists_initialized','1')",
                [],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(Self { db })
    }
    #[cfg(feature = "ui-tests")]
    pub fn seed_ui_fixtures(&mut self) -> Result<(), String> {
        let fixtures: Vec<Value> =
            serde_json::from_str(include_str!("../../tests/ui/fixtures.json"))
                .map_err(|e| e.to_string())?;
        let tx = self.db.transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM local_gists", [])
            .map_err(|e| e.to_string())?;
        for gist in fixtures.iter().rev() {
            let id = gist
                .get("id")
                .and_then(Value::as_str)
                .ok_or("Invalid UI fixture")?;
            tx.execute(
                "INSERT INTO local_gists (id,payload) VALUES (?1,?2)",
                params![id, gist.to_string()],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn list(&self) -> Result<Vec<Value>, String> {
        let mut stmt = self
            .db
            .prepare("SELECT payload FROM local_gists ORDER BY rowid DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        rows.map(|r| {
            serde_json::from_str(&r.map_err(|e| e.to_string())?).map_err(|e| e.to_string())
        })
        .collect()
    }
    pub fn get(&self, id: &str) -> Result<Value, String> {
        let raw: Option<String> = self
            .db
            .query_row("SELECT payload FROM local_gists WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&raw.ok_or("Snippet not found")?).map_err(|e| e.to_string())
    }
    pub fn create(
        &self,
        description: &str,
        files: &Value,
        public: bool,
        updated_at: &str,
    ) -> Result<Value, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let mut gist = json!({"id":id,"description":description,"public":public,"html_url":"","updated_at":updated_at,"files":{}});
        Self::apply_files(&mut gist, files)?;
        self.db
            .execute(
                "INSERT INTO local_gists (id,payload) VALUES (?1,?2)",
                params![id, gist.to_string()],
            )
            .map_err(|e| e.to_string())?;
        Ok(gist)
    }
    pub fn update(
        &mut self,
        id: &str,
        description: &str,
        files: &Value,
        updated_at: &str,
    ) -> Result<Value, String> {
        let tx = self.db.transaction().map_err(|e| e.to_string())?;
        let raw: Option<String> = tx
            .query_row("SELECT payload FROM local_gists WHERE id=?1", [id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(|e| e.to_string())?;
        let mut gist: Value =
            serde_json::from_str(&raw.ok_or("Snippet not found")?).map_err(|e| e.to_string())?;
        gist["description"] = json!(description);
        gist["updated_at"] = json!(updated_at);
        Self::apply_files(&mut gist, files)?;
        tx.execute(
            "UPDATE local_gists SET payload=?2 WHERE id=?1",
            params![id, gist.to_string()],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(gist)
    }
    fn apply_files(gist: &mut Value, patch: &Value) -> Result<(), String> {
        let entries = patch.as_object().ok_or("Invalid files")?;
        let files = gist["files"]
            .as_object_mut()
            .ok_or("Invalid stored files")?;
        for (name, data) in entries {
            if name.trim().is_empty() {
                return Err("Filename is required".into());
            }
            if data.is_null() {
                files.remove(name);
                continue;
            }
            let content = data
                .get("content")
                .and_then(Value::as_str)
                .ok_or("File content must be text")?;
            if content.len() > 2 * 1024 * 1024 {
                return Err("File content exceeds 2 MB".into());
            }
            files.insert(
                name.clone(),
                json!({"filename":name,"language":language(name),"content":content}),
            );
        }
        if files.is_empty() {
            return Err("A snippet must contain a file".into());
        }
        Ok(())
    }
    pub fn delete(&self, id: &str) -> Result<(), String> {
        if self
            .db
            .execute("DELETE FROM local_gists WHERE id=?1", [id])
            .map_err(|e| e.to_string())?
            == 0
        {
            return Err("Snippet not found".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migrates_and_handles_multi_file_crud_transactionally() {
        let dir = tempfile::tempdir().unwrap();
        crate::library::Library::open(dir.path().into()).unwrap();
        let mut store = LocalGists::open(dir.path()).unwrap();
        let count = store.list().unwrap().len();
        let gist = store
            .create(
                "[Test] #example",
                &json!({"a.js":{"content":"one"},"b.md":{"content":"two"}}),
                false,
                "2026-01-01T00:00:00Z",
            )
            .unwrap();
        let id = gist["id"].as_str().unwrap();
        assert_eq!(store.list().unwrap().len(), count + 1);
        let updated = store
            .update(
                id,
                "changed",
                &json!({"a.js":null,"c.py":{"content":"three"}}),
                "2026-01-02T00:00:00Z",
            )
            .unwrap();
        assert!(updated["files"].get("a.js").is_none());
        assert_eq!(updated["files"]["c.py"]["language"], "Python");
        assert!(store
            .update(id, "bad", &json!({"b.md":null,"c.py":null}), "x")
            .is_err());
        assert_eq!(store.get(id).unwrap()["description"], "changed");
        store.delete(id).unwrap();
        assert!(store.get(id).is_err());
        drop(store);
        assert_eq!(
            LocalGists::open(dir.path()).unwrap().list().unwrap().len(),
            count
        );
    }
}
