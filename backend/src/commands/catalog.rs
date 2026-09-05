use crate::database::open_database;
use rusqlite::{params, Connection};

fn text(value: &str, label: &str, max: usize, required: bool) -> Result<String, String> {
    let value = value.trim();
    if (required && value.is_empty()) || value.chars().count() > max {
        return Err(format!(
            "{label}: informe {} a {max} caracteres",
            if required { 1 } else { 0 }
        ));
    }
    Ok(value.to_string())
}

fn rename(connection: &Connection, id: &str, name: &str) -> Result<(), String> {
    let name = text(name, "Nome da playlist", 80, true)?;
    let changed = connection
        .execute(
            "UPDATE playlists SET name = ?1 WHERE id = ?2",
            params![name, id],
        )
        .map_err(|e| format!("não foi possível renomear a playlist: {e}"))?;
    if changed == 0 {
        return Err("playlist não encontrada".into());
    }
    Ok(())
}

fn delete(connection: &Connection, id: &str) -> Result<(), String> {
    // Foreign keys remove only playlist membership. Tracks and media files are untouched.
    let changed = connection
        .execute("DELETE FROM playlists WHERE id = ?1", [id])
        .map_err(|e| format!("não foi possível excluir a playlist: {e}"))?;
    if changed == 0 {
        return Err("playlist não encontrada".into());
    }
    Ok(())
}

fn edit(
    connection: &Connection,
    id: &str,
    title: &str,
    artist: &str,
    album: &str,
) -> Result<(), String> {
    let title = text(title, "Título", 200, true)?;
    let artist = text(artist, "Artista", 200, false)?;
    let album = text(album, "Álbum", 200, false)?;
    let changed = connection
        .execute(
            "UPDATE tracks SET title = ?1, artist = ?2, album = ?3 WHERE id = ?4",
            params![title, artist, album, id],
        )
        .map_err(|e| format!("não foi possível editar a mídia: {e}"))?;
    if changed == 0 {
        return Err("mídia não encontrada".into());
    }
    Ok(())
}

#[tauri::command]
pub fn rename_playlist(
    app: tauri::AppHandle,
    playlist_id: String,
    name: String,
) -> Result<(), String> {
    rename(&open_database(&app)?, &playlist_id, &name)
}

#[tauri::command]
pub fn delete_playlist(app: tauri::AppHandle, playlist_id: String) -> Result<(), String> {
    delete(&open_database(&app)?, &playlist_id)
}

#[tauri::command]
pub fn update_track_metadata(
    app: tauri::AppHandle,
    track_id: String,
    title: String,
    artist: String,
    album: String,
) -> Result<(), String> {
    edit(&open_database(&app)?, &track_id, &title, &artist, &album)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn database() -> Connection {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("PRAGMA foreign_keys=ON;
            CREATE TABLE playlists (id TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE tracks (id TEXT PRIMARY KEY, title TEXT, artist TEXT, album TEXT, file_path TEXT);
            CREATE TABLE playlist_tracks (
                playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
                track_id TEXT REFERENCES tracks(id) ON DELETE CASCADE, position INTEGER);
            INSERT INTO playlists VALUES ('p1','Primeira'), ('p2','Segunda');
            INSERT INTO tracks VALUES ('t1','Título','Artista','Álbum','original.mp4');
            INSERT INTO playlist_tracks VALUES ('p1','t1',0), ('p2','t1',0);").unwrap();
        db
    }

    #[test]
    fn deleting_playlist_preserves_tracks_and_other_playlists() {
        let db = database();
        delete(&db, "p1").unwrap();
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM playlists", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            db.query_row("SELECT playlist_id FROM playlist_tracks", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "p2"
        );
        assert_eq!(
            db.query_row("SELECT file_path FROM tracks", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "original.mp4"
        );
        assert!(delete(&db, "missing").is_err());
    }

    #[test]
    fn rename_validates_and_preserves_membership() {
        let db = database();
        assert!(rename(&db, "p1", "  ").is_err());
        assert!(rename(&db, "p1", &"a".repeat(81)).is_err());
        assert!(rename(&db, "missing", "Nome").is_err());
        rename(&db, "p1", "  D'água 🎵  ").unwrap();
        assert_eq!(
            db.query_row("SELECT name FROM playlists WHERE id='p1'", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "D'água 🎵"
        );
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM playlist_tracks", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            2
        );
    }

    #[test]
    fn metadata_edit_is_atomic_and_keeps_file_and_membership() {
        let db = database();
        assert!(edit(&db, "t1", "Novo", &"a".repeat(201), "").is_err());
        assert_eq!(
            db.query_row("SELECT title FROM tracks", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "Título"
        );
        assert!(edit(&db, "t1", " ", "", "").is_err());
        assert!(edit(&db, "missing", "Novo", "", "").is_err());
        edit(&db, "t1", " Novo ", "", " Álbum 2 ").unwrap();
        assert_eq!(
            db.query_row(
                "SELECT title || '|' || artist || '|' || album || '|' || file_path FROM tracks",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
            "Novo||Álbum 2|original.mp4"
        );
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM playlist_tracks", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            2
        );
    }
}
