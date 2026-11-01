use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::PathBuf};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub filename: String,
    pub tags: Vec<String>,
    pub content: String,
}

#[derive(Deserialize)]
pub struct Draft {
    pub id: Option<String>,
    pub title: String,
    pub filename: String,
    pub tags: Vec<String>,
    pub content: String,
}

#[derive(Deserialize)]
struct Document {
    version: u32,
    snippets: Vec<Snippet>,
}

pub struct Library {
    db: Connection,
}

fn tokens(text: &str) -> HashSet<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect()
}

impl Library {
    pub fn open(directory: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let mut db =
            Connection::open(directory.join("snippets.sqlite3")).map_err(|e| e.to_string())?;
        db.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        let tx = db.transaction().map_err(|e| e.to_string())?;
        let version: i64 = tx
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if version == 0 {
            let initial: Vec<Snippet> = match fs::read(directory.join("snippets.json")) {
                Ok(bytes) => {
                    let doc: Document =
                        serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                    if doc.version != 1 {
                        return Err("Unsupported JSON library version".into());
                    }
                    doc.snippets
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    serde_json::from_str(include_str!("../../fixtures.json"))
                        .map_err(|e| e.to_string())?
                }
                Err(e) => return Err(e.to_string()),
            };
            tx.execute_batch("CREATE TABLE snippets (id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL, tags TEXT NOT NULL, content TEXT NOT NULL); PRAGMA user_version = 1;").map_err(|e| e.to_string())?;
            // Insert in reverse so descending rowid preserves the old display order.
            for s in initial.iter().rev() {
                let tags = serde_json::to_string(&s.tags).map_err(|e| e.to_string())?;
                tx.execute(
                    "INSERT INTO snippets (id,title,filename,tags,content) VALUES (?1,?2,?3,?4,?5)",
                    params![s.id, s.title, s.filename, tags, s.content],
                )
                .map_err(|e| e.to_string())?;
            }
        } else if version != 1 {
            return Err(format!("Unsupported SQLite library version: {version}"));
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(Self { db })
    }

    pub fn search(&self, query: &str) -> Result<Vec<Snippet>, String> {
        let mut stmt = self
            .db
            .prepare("SELECT id,title,filename,tags,content FROM snippets ORDER BY rowid DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let raw: String = row.get(3)?;
                let tags = serde_json::from_str(&raw).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        3,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?;
                Ok(Snippet {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    filename: row.get(2)?,
                    tags,
                    content: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let query_tokens = tokens(query);
        let mut found = Vec::new();
        for row in rows {
            let s = row.map_err(|e| e.to_string())?;
            if query_tokens.is_subset(&tokens(&format!(
                "{} {} {} {}",
                s.title,
                s.filename,
                s.tags.join(" "),
                s.content
            ))) {
                found.push(s);
            }
        }
        Ok(found)
    }

    pub fn save(&mut self, draft: Draft) -> Result<Snippet, String> {
        if draft.title.trim().is_empty() || draft.filename.trim().is_empty() {
            return Err("Title and filename are required".into());
        }
        if draft.content.len() > 2 * 1024 * 1024 {
            return Err("Prototype snippets are limited to 2 MB".into());
        }
        let snippet = Snippet {
            id: draft
                .id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            title: draft.title.trim().into(),
            filename: draft.filename.trim().into(),
            tags: draft
                .tags
                .into_iter()
                .map(|t| t.trim().to_owned())
                .filter(|t| !t.is_empty())
                .collect(),
            content: draft.content,
        };
        let tags = serde_json::to_string(&snippet.tags).map_err(|e| e.to_string())?;
        if draft.id.is_some() {
            let changed = self
                .db
                .execute(
                    "UPDATE snippets SET title=?2, filename=?3, tags=?4, content=?5 WHERE id=?1",
                    params![
                        snippet.id,
                        snippet.title,
                        snippet.filename,
                        tags,
                        snippet.content
                    ],
                )
                .map_err(|e| e.to_string())?;
            if changed == 0 {
                return Err("Snippet no longer exists".into());
            }
        } else {
            self.db
                .execute(
                    "INSERT INTO snippets (id,title,filename,tags,content) VALUES (?1,?2,?3,?4,?5)",
                    params![
                        snippet.id,
                        snippet.title,
                        snippet.filename,
                        tags,
                        snippet.content
                    ],
                )
                .map_err(|e| e.to_string())?;
        }
        Ok(snippet)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn draft(id: Option<String>) -> Draft {
        Draft {
            id,
            title: "Saved example".into(),
            filename: "example.rs".into(),
            tags: vec!["rust".into()],
            content: "fn persisted_value() {}".into(),
        }
    }
    #[test]
    fn searches_and_reopens_created_and_updated_snippets() {
        let dir = tempfile::tempdir().unwrap();
        let mut library = Library::open(dir.path().into()).unwrap();
        let count = library.search("").unwrap().len();
        let created = library.save(draft(None)).unwrap();
        assert_eq!(library.search("RUST persisted_value").unwrap().len(), 1);
        assert!(library.search("persisted").unwrap().is_empty());
        let mut edit = draft(Some(created.id));
        edit.content = "updated content".into();
        library.save(edit).unwrap();
        drop(library);
        let reopened = Library::open(dir.path().into()).unwrap();
        assert_eq!(reopened.search("").unwrap().len(), count + 1);
        assert_eq!(
            reopened.search("updated").unwrap()[0].content,
            "updated content"
        );
    }
    #[test]
    fn migrates_json_once_without_changing_source() {
        let dir = tempfile::tempdir().unwrap();
        let source = r#"{"version":1,"snippets":[{"id":"old","title":"Old","filename":"old.txt","tags":[],"content":"legacy"}]}"#;
        fs::write(dir.path().join("snippets.json"), source).unwrap();
        let mut lib = Library::open(dir.path().into()).unwrap();
        assert_eq!(lib.search("legacy").unwrap().len(), 1);
        lib.save(draft(None)).unwrap();
        drop(lib);
        assert_eq!(
            Library::open(dir.path().into())
                .unwrap()
                .search("")
                .unwrap()
                .len(),
            2
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("snippets.json")).unwrap(),
            source
        );
    }
    #[test]
    fn invalid_json_rolls_back_and_can_be_retried() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snippets.json");
        fs::write(&path, "broken").unwrap();
        assert!(Library::open(dir.path().into()).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "broken");
        fs::write(&path, r#"{"version":1,"snippets":[]}"#).unwrap();
        assert!(Library::open(dir.path().into())
            .unwrap()
            .search("")
            .unwrap()
            .is_empty());
    }
    #[test]
    fn validates_updates_and_database_version() {
        let dir = tempfile::tempdir().unwrap();
        let mut lib = Library::open(dir.path().into()).unwrap();
        assert!(lib.save(draft(Some("missing".into()))).is_err());
        let mut invalid = draft(None);
        invalid.title = " ".into();
        assert!(lib.save(invalid).is_err());
        lib.db.pragma_update(None, "user_version", 99).unwrap();
        drop(lib);
        assert!(Library::open(dir.path().into()).is_err());
    }
    #[test]
    fn multiple_connections_see_committed_updates() {
        let dir = tempfile::tempdir().unwrap();
        let mut first = Library::open(dir.path().into()).unwrap();
        let mut second = Library::open(dir.path().into()).unwrap();
        let created = first.save(draft(None)).unwrap();
        assert_eq!(second.search("persisted_value").unwrap().len(), 1);
        let mut changed = draft(Some(created.id));
        changed.content = "concurrent".into();
        second.save(changed).unwrap();
        assert_eq!(first.search("concurrent").unwrap().len(), 1);
    }
}
