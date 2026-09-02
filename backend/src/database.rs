use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackRecord {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_seconds: i64,
    pub file_path: String,
    pub file_name: String,
    pub source: String,
    pub source_url: Option<String>,
    pub is_liked: bool,
    pub is_favorite: bool,
    pub cover_seed: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistRecord {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub user_name: String,
    pub app_title: String,
    pub theme_mode: String,
    pub primary_color: String,
    pub accent_color: String,
    pub light_background: String,
    pub dark_background: String,
    pub reduce_motion: bool,
    pub compact_mode: bool,
    pub autoplay: bool,
    pub shuffle_enabled: bool,
    pub repeat_mode: String,
    pub volume: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub settings: AppSettings,
    pub tracks: Vec<TrackRecord>,
    pub playlists: Vec<PlaylistRecord>,
}

pub struct AppPaths {
    pub media: PathBuf,
    pub database: PathBuf,
}

pub fn app_paths(app: &tauri::AppHandle) -> Result<AppPaths, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("diretório da aplicação indisponível: {error}"))?;
    let media = root.join("media");
    fs::create_dir_all(&media)
        .map_err(|error| format!("não foi possível preparar a biblioteca: {error}"))?;

    Ok(AppPaths {
        database: root.join("naki-play.sqlite3"),
        media,
    })
}

pub fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let paths = app_paths(app)?;
    let connection = Connection::open(paths.database)
        .map_err(|error| format!("não foi possível abrir o banco local: {error}"))?;

    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;

             CREATE TABLE IF NOT EXISTS settings (
               id INTEGER PRIMARY KEY CHECK (id = 1),
               user_name TEXT NOT NULL,
               app_title TEXT NOT NULL,
               theme_mode TEXT NOT NULL,
               primary_color TEXT NOT NULL,
               accent_color TEXT NOT NULL,
               light_background TEXT NOT NULL,
               dark_background TEXT NOT NULL,
               reduce_motion INTEGER NOT NULL DEFAULT 0,
               compact_mode INTEGER NOT NULL DEFAULT 0,
               autoplay INTEGER NOT NULL DEFAULT 1,
               volume REAL NOT NULL DEFAULT 0.82
             );

             CREATE TABLE IF NOT EXISTS schema_meta (
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL
             );

             CREATE TABLE IF NOT EXISTS tracks (
               id TEXT PRIMARY KEY,
               title TEXT NOT NULL,
               artist TEXT NOT NULL,
               album TEXT NOT NULL,
               duration_seconds INTEGER NOT NULL DEFAULT 0,
               file_path TEXT NOT NULL UNIQUE,
               file_name TEXT NOT NULL,
               source TEXT NOT NULL,
               source_url TEXT,
               is_liked INTEGER NOT NULL DEFAULT 0,
               is_favorite INTEGER NOT NULL DEFAULT 0,
               cover_seed INTEGER NOT NULL DEFAULT 0,
               created_at INTEGER NOT NULL
             );

             CREATE TABLE IF NOT EXISTS playlists (
               id TEXT PRIMARY KEY,
               name TEXT NOT NULL,
               created_at INTEGER NOT NULL
             );

             CREATE TABLE IF NOT EXISTS playlist_tracks (
               playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
               track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
               position INTEGER NOT NULL DEFAULT 0,
               PRIMARY KEY (playlist_id, track_id)
             );

             INSERT OR IGNORE INTO settings (
               id, user_name, app_title, theme_mode, primary_color, accent_color,
               light_background, dark_background, reduce_motion, compact_mode,
               autoplay, volume
             ) VALUES (
               1, 'Meu amor', 'Naki', 'system', '#60354f', '#b75f8b',
               '#fbf9f7', '#171218', 0, 0, 1, 0.82
             );",
        )
        .map_err(|error| format!("não foi possível preparar o banco local: {error}"))?;

    ensure_settings_column(
        &connection,
        "shuffle_enabled",
        "ALTER TABLE settings ADD COLUMN shuffle_enabled INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_settings_column(
        &connection,
        "repeat_mode",
        "ALTER TABLE settings ADD COLUMN repeat_mode TEXT NOT NULL DEFAULT 'off'",
    )?;

    let playback_defaults_applied = connection
        .query_row(
            "SELECT value FROM schema_meta WHERE key = 'playback-defaults-v1'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| {
            format!("não foi possível verificar a atualização de reprodução: {error}")
        })?
        .is_some();
    if !playback_defaults_applied {
        connection
            .execute("UPDATE settings SET autoplay = 1 WHERE id = 1", [])
            .map_err(|error| format!("não foi possível ativar a reprodução contínua: {error}"))?;
        connection
            .execute(
                "INSERT INTO schema_meta (key, value) VALUES ('playback-defaults-v1', 'applied')",
                [],
            )
            .map_err(|error| {
                format!("não foi possível registrar a atualização de reprodução: {error}")
            })?;
    }

    Ok(connection)
}

fn ensure_settings_column(
    connection: &Connection,
    column_name: &str,
    migration: &str,
) -> Result<(), String> {
    let mut statement = connection
        .prepare("PRAGMA table_info(settings)")
        .map_err(|error| format!("não foi possível verificar as configurações: {error}"))?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("não foi possível ler as configurações: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("não foi possível listar as configurações: {error}"))?;
    drop(statement);
    if !columns.iter().any(|column| column == column_name) {
        connection
            .execute_batch(migration)
            .map_err(|error| format!("não foi possível atualizar as configurações: {error}"))?;
    }
    Ok(())
}

pub fn load_settings(connection: &Connection) -> Result<AppSettings, String> {
    connection
        .query_row(
            "SELECT user_name, app_title, theme_mode, primary_color, accent_color,
                    light_background, dark_background, reduce_motion, compact_mode,
                    autoplay, shuffle_enabled, repeat_mode, volume
             FROM settings WHERE id = 1",
            [],
            |row| {
                Ok(AppSettings {
                    user_name: row.get(0)?,
                    app_title: row.get(1)?,
                    theme_mode: row.get(2)?,
                    primary_color: row.get(3)?,
                    accent_color: row.get(4)?,
                    light_background: row.get(5)?,
                    dark_background: row.get(6)?,
                    reduce_motion: row.get::<_, i64>(7)? != 0,
                    compact_mode: row.get::<_, i64>(8)? != 0,
                    autoplay: row.get::<_, i64>(9)? != 0,
                    shuffle_enabled: row.get::<_, i64>(10)? != 0,
                    repeat_mode: row.get(11)?,
                    volume: row.get(12)?,
                })
            },
        )
        .map_err(|error| format!("não foi possível ler as configurações: {error}"))
}

pub fn load_tracks(connection: &Connection) -> Result<Vec<TrackRecord>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, artist, album, duration_seconds, file_path, file_name,
                    source, source_url, is_liked, is_favorite, cover_seed
             FROM tracks ORDER BY created_at DESC",
        )
        .map_err(|error| format!("não foi possível consultar as músicas: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(TrackRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                duration_seconds: row.get(4)?,
                file_path: row.get(5)?,
                file_name: row.get(6)?,
                source: row.get(7)?,
                source_url: row.get(8)?,
                is_liked: row.get::<_, i64>(9)? != 0,
                is_favorite: row.get::<_, i64>(10)? != 0,
                cover_seed: row.get(11)?,
            })
        })
        .map_err(|error| format!("não foi possível carregar as músicas: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("não foi possível montar a biblioteca: {error}"))
}

pub fn load_playlists(connection: &Connection) -> Result<Vec<PlaylistRecord>, String> {
    let mut playlist_statement = connection
        .prepare("SELECT id, name FROM playlists ORDER BY created_at ASC")
        .map_err(|error| format!("não foi possível consultar as playlists: {error}"))?;
    let playlist_rows = playlist_statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("não foi possível carregar as playlists: {error}"))?;

    let mut playlists = Vec::new();
    for playlist in playlist_rows {
        let (id, name) =
            playlist.map_err(|error| format!("não foi possível ler uma playlist: {error}"))?;
        let mut track_statement = connection
            .prepare(
                "SELECT track_id FROM playlist_tracks
                 WHERE playlist_id = ?1 ORDER BY position ASC",
            )
            .map_err(|error| format!("não foi possível consultar a playlist: {error}"))?;
        let track_ids = track_statement
            .query_map([&id], |row| row.get::<_, String>(0))
            .map_err(|error| format!("não foi possível ler as faixas da playlist: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("não foi possível montar a playlist: {error}"))?;

        playlists.push(PlaylistRecord {
            id,
            name,
            track_ids,
        });
    }

    Ok(playlists)
}

pub fn load_snapshot(app: &tauri::AppHandle) -> Result<AppSnapshot, String> {
    let connection = open_database(app)?;
    Ok(AppSnapshot {
        settings: load_settings(&connection)?,
        tracks: load_tracks(&connection)?,
        playlists: load_playlists(&connection)?,
    })
}

pub fn insert_track(connection: &Connection, track: &TrackRecord) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO tracks (
               id, title, artist, album, duration_seconds, file_path, file_name,
               source, source_url, is_liked, is_favorite, cover_seed, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                       CAST(strftime('%s', 'now') AS INTEGER))",
            params![
                track.id,
                track.title,
                track.artist,
                track.album,
                track.duration_seconds,
                track.file_path,
                track.file_name,
                track.source,
                track.source_url,
                i64::from(track.is_liked),
                i64::from(track.is_favorite),
                track.cover_seed,
            ],
        )
        .map_err(|error| format!("não foi possível registrar a música: {error}"))?;
    Ok(())
}
