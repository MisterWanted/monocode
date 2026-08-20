use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;

use crate::dirs_home;

/// In-flight tool args live in the newest assistant blobs. Scanning the whole
/// store parses every historical message (often megabytes) on a 100ms poll.
const MAX_RECENT_BLOBS: i64 = 24;
const MAX_BLOB_BYTES: usize = 256 * 1024;

static STORE_PATHS: Mutex<Option<HashMap<String, PathBuf>>> = Mutex::new(None);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorToolCall {
    tool_call_id: String,
    tool_name: String,
    args: Value,
}

/// Recover tool arguments that Cursor currently omits from its ACP events.
///
/// Cursor persists the complete call in a per-session SQLite store before
/// sending the corresponding result. MonoCode only opens that store read-only.
#[tauri::command]
pub async fn cursor_tool_calls(
    session_id: String,
    tool_call_ids: Vec<String>,
) -> Result<Vec<CursorToolCall>, String> {
    validate_id(&session_id, "session")?;
    if tool_call_ids.len() > 256 {
        return Err("Too many tool call ids".into());
    }
    for tool_call_id in &tool_call_ids {
        validate_id(tool_call_id, "tool call")?;
    }

    tauri::async_runtime::spawn_blocking(move || {
        let store = find_session_store(&session_id)?;
        read_tool_calls(&store, &tool_call_ids)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn validate_id(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(format!("Invalid {label} id"));
    }
    Ok(())
}

fn find_session_store(session_id: &str) -> Result<PathBuf, String> {
    if let Some(path) = cached_store_path(session_id) {
        if path.is_file() {
            return Ok(path);
        }
        forget_store_path(session_id);
    }

    let home = dirs_home().ok_or("Home directory is unavailable")?;
    let cursor_dir = PathBuf::from(home).join(".cursor");
    let current = cursor_dir
        .join("acp-sessions")
        .join(session_id)
        .join("store.db");
    if current.is_file() {
        remember_store_path(session_id, current.clone());
        return Ok(current);
    }

    let chats = cursor_dir.join("chats");
    let entries = std::fs::read_dir(&chats)
        .map_err(|_| format!("Cursor session {session_id} was not found"))?;
    for entry in entries.flatten() {
        let candidate = entry.path().join(session_id).join("store.db");
        if candidate.is_file() {
            remember_store_path(session_id, candidate.clone());
            return Ok(candidate);
        }
    }

    Err(format!("Cursor session {session_id} was not found"))
}

fn cached_store_path(session_id: &str) -> Option<PathBuf> {
    let guard = STORE_PATHS.lock().unwrap_or_else(|e| e.into_inner());
    guard.as_ref()?.get(session_id).cloned()
}

fn remember_store_path(session_id: &str, path: PathBuf) {
    let mut guard = STORE_PATHS.lock().unwrap_or_else(|e| e.into_inner());
    guard
        .get_or_insert_with(HashMap::new)
        .insert(session_id.to_string(), path);
}

fn forget_store_path(session_id: &str) {
    let mut guard = STORE_PATHS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(map) = guard.as_mut() {
        map.remove(session_id);
    }
}

fn read_tool_calls(path: &Path, tool_call_ids: &[String]) -> Result<Vec<CursorToolCall>, String> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| e.to_string())?;
    lookup_tool_calls(&connection, tool_call_ids).map_err(|e| e.to_string())
}

fn lookup_tool_calls(
    connection: &Connection,
    tool_call_ids: &[String],
) -> rusqlite::Result<Vec<CursorToolCall>> {
    let wanted: HashSet<&str> = tool_call_ids.iter().map(String::as_str).collect();
    if wanted.is_empty() {
        return Ok(Vec::new());
    }

    let mut found = Vec::new();
    let mut statement =
        connection.prepare("SELECT data FROM blobs ORDER BY rowid DESC LIMIT ?1")?;
    let rows = statement.query_map([MAX_RECENT_BLOBS], |row| row.get::<_, Vec<u8>>(0))?;

    for row in rows {
        let Ok(data) = row else { continue };
        if data.len() > MAX_BLOB_BYTES {
            continue;
        }
        let Ok(payload) = serde_json::from_slice::<Value>(&data) else {
            continue;
        };
        let Some(content) = payload.get("content").and_then(Value::as_array) else {
            continue;
        };

        for item in content {
            let Some(tool_call_id) = item.get("toolCallId").and_then(Value::as_str) else {
                continue;
            };
            if item.get("type").and_then(Value::as_str) != Some("tool-call")
                || !wanted.contains(tool_call_id)
                || found
                    .iter()
                    .any(|call: &CursorToolCall| call.tool_call_id == tool_call_id)
            {
                continue;
            }
            let Some(tool_name) = item.get("toolName").and_then(Value::as_str) else {
                continue;
            };
            let Some(args) = item.get("args") else {
                continue;
            };
            found.push(CursorToolCall {
                tool_call_id: tool_call_id.to_owned(),
                tool_name: tool_name.to_owned(),
                args: args.clone(),
            });
            if found.len() == wanted.len() {
                return Ok(found);
            }
        }
    }

    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn finds_tool_call_and_skips_non_json_blobs() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute("CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB)", [])
            .unwrap();
        connection
            .execute(
                "INSERT INTO blobs (id, data) VALUES (?1, ?2)",
                params!["binary", vec![0_u8, 159, 146, 150]],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO blobs (id, data) VALUES (?1, ?2)",
                params![
                    "assistant",
                    br#"{"role":"assistant","content":[{"type":"tool-call","toolCallId":"tool_123","toolName":"Read","args":{"path":"/tmp/example.ts"}}]}"#
                ],
            )
            .unwrap();

        let ids = vec!["tool_123".to_owned(), "tool_missing".to_owned()];
        let calls = lookup_tool_calls(&connection, &ids).unwrap();
        assert_eq!(calls.len(), 1);
        let call = &calls[0];
        assert_eq!(call.tool_call_id, "tool_123");
        assert_eq!(call.tool_name, "Read");
        assert_eq!(call.args["path"], "/tmp/example.ts");
    }

    #[test]
    fn skips_oversized_blobs_and_prefers_recent_rows() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute("CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB)", [])
            .unwrap();
        connection
            .execute(
                "INSERT INTO blobs (id, data) VALUES (?1, ?2)",
                params!["huge", vec![b'x'; MAX_BLOB_BYTES + 1]],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO blobs (id, data) VALUES (?1, ?2)",
                params![
                    "assistant",
                    br#"{"role":"assistant","content":[{"type":"tool-call","toolCallId":"tool_recent","toolName":"Edit","args":{"path":"/tmp/new.ts"}}]}"#
                ],
            )
            .unwrap();

        let calls = lookup_tool_calls(&connection, &["tool_recent".to_owned()]).unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].tool_call_id, "tool_recent");
        assert_eq!(calls[0].args["path"], "/tmp/new.ts");
    }
}
