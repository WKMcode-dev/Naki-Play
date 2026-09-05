use crate::database::{
    app_paths, insert_track, load_snapshot, open_database, AppSnapshot, PlaylistRecord, TrackRecord,
};
use rusqlite::{Connection, OptionalExtension};
use serde::Deserialize;
use std::{
    collections::HashSet,
    ffi::{OsStr, OsString},
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    thread,
    time::Duration,
};
use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};
use uuid::Uuid;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "mp4", "webm", "mov",
];
const MAX_DOWNLOAD_BYTES: u64 = 220 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    path: String,
    name: String,
}

#[tauri::command]
pub fn bootstrap_library(app: tauri::AppHandle) -> Result<AppSnapshot, String> {
    let paths = app_paths(&app)?;
    let snapshot = load_snapshot(&app)?;
    let live_file_names = snapshot
        .tracks
        .iter()
        .filter_map(|track| {
            Path::new(&track.file_path)
                .file_name()
                .map(OsStr::to_os_string)
        })
        .collect::<HashSet<_>>();
    reconcile_deleting_files(&paths.media, &live_file_names);
    Ok(snapshot)
}

fn clean_file_name(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => character,
        })
        .collect::<String>()
        .trim()
        .chars()
        .take(160)
        .collect()
}

fn title_from_name(value: &str) -> String {
    let cleaned = clean_file_name(value);
    let path = Path::new(&cleaned);
    let title = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Música importada")
        .replace(['_', '-'], " ")
        .trim()
        .to_string();

    if title.is_empty() || title.chars().all(|character| character.is_ascii_digit()) {
        "Música importada".to_string()
    } else {
        title
    }
}

fn extension_from_name(value: &str) -> Option<String> {
    Path::new(value)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_lowercase)
        .filter(|extension| SUPPORTED_EXTENSIONS.contains(&extension.as_str()))
}

fn extension_from_mime(mime: &str) -> Option<&'static str> {
    match mime {
        "audio/mpeg" | "audio/mp3" => Some("mp3"),
        "audio/wav" | "audio/x-wav" | "audio/vnd.wave" => Some("wav"),
        "audio/aac" => Some("aac"),
        "audio/flac" | "audio/x-flac" => Some("flac"),
        "audio/ogg" | "application/ogg" => Some("ogg"),
        "audio/opus" => Some("opus"),
        "audio/mp4" => Some("m4a"),
        "video/mp4" => Some("mp4"),
        "video/webm" | "audio/webm" => Some("webm"),
        "video/quicktime" => Some("mov"),
        _ => None,
    }
}

fn detect_extension(path: &Path, suggested_name: &str) -> Result<String, String> {
    if let Some(extension) = extension_from_name(suggested_name) {
        return Ok(extension);
    }

    infer::get_from_path(path)
        .map_err(|error| format!("não foi possível identificar o formato: {error}"))?
        .and_then(|kind| extension_from_mime(kind.mime_type()))
        .map(str::to_string)
        .ok_or_else(|| {
            "o arquivo escolhido não possui um formato de áudio ou vídeo compatível".to_string()
        })
}

fn cover_seed(id: &Uuid) -> i64 {
    (id.as_u128() % 8) as i64
}

fn copy_import_to_library(
    app: &tauri::AppHandle,
    request: &ImportRequest,
) -> Result<TrackRecord, String> {
    let paths = app_paths(app)?;
    let id = Uuid::new_v4();
    let temporary_path = paths.media.join(format!("{id}.importing"));
    let file_path: FilePath = request
        .path
        .parse()
        .map_err(|_| "o endereço do arquivo selecionado é inválido".to_string())?;
    let mut open_options = OpenOptions::new();
    open_options.read(true);
    let mut source = app
        .fs()
        .open(file_path, open_options)
        .map_err(|error| format!("não foi possível abrir o arquivo selecionado: {error}"))?;
    let mut destination = fs::File::create(&temporary_path)
        .map_err(|error| format!("não foi possível criar a cópia local: {error}"))?;

    io::copy(&mut source, &mut destination)
        .map_err(|error| format!("não foi possível copiar a música: {error}"))?;
    destination
        .flush()
        .map_err(|error| format!("não foi possível finalizar a cópia: {error}"))?;

    let extension = match detect_extension(&temporary_path, &request.name) {
        Ok(extension) => extension,
        Err(error) => {
            let _ = fs::remove_file(&temporary_path);
            return Err(error);
        }
    };
    let destination_path = paths.media.join(format!("{id}.{extension}"));
    fs::rename(&temporary_path, &destination_path)
        .map_err(|error| format!("não foi possível finalizar o arquivo local: {error}"))?;
    let file_name = if request.name.trim().is_empty() {
        format!("Música importada.{extension}")
    } else {
        clean_file_name(&request.name)
    };

    Ok(TrackRecord {
        id: id.to_string(),
        title: title_from_name(&file_name),
        artist: "Arquivo pessoal".to_string(),
        album: "Adicionadas por você".to_string(),
        duration_seconds: 0,
        file_path: destination_path.to_string_lossy().into_owned(),
        file_name,
        source: "local".to_string(),
        source_url: None,
        is_liked: false,
        is_favorite: false,
        cover_seed: cover_seed(&id),
    })
}

#[tauri::command]
pub fn import_tracks(
    app: tauri::AppHandle,
    items: Vec<ImportRequest>,
) -> Result<Vec<TrackRecord>, String> {
    if items.is_empty() {
        return Ok(Vec::new());
    }

    let connection = open_database(&app)?;
    let mut imported = Vec::new();
    for item in &items {
        let track = copy_import_to_library(&app, item)?;
        if let Err(error) = insert_track(&connection, &track) {
            let _ = fs::remove_file(&track.file_path);
            return Err(error);
        }
        imported.push(track);
    }
    Ok(imported)
}

fn blocked_streaming_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    [
        "youtube.com",
        "youtu.be",
        "googlevideo.com",
        "spotify.com",
        "scdn.co",
    ]
    .iter()
    .any(|blocked| host == *blocked || host.ends_with(&format!(".{blocked}")))
}

#[tauri::command]
pub async fn download_track_from_url(
    app: tauri::AppHandle,
    url: String,
) -> Result<TrackRecord, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| {
        "informe um link direto válido começando com http:// ou https://".to_string()
    })?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("somente links http:// e https:// são aceitos".to_string());
    }
    let host = parsed.host_str().unwrap_or_default();
    if blocked_streaming_host(host) {
        return Err(
            "links do YouTube e Spotify não podem ser baixados; use um arquivo próprio ou uma URL direta autorizada"
                .to_string(),
        );
    }

    let client = reqwest::Client::builder()
        .user_agent("Naki-Play/0.1")
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|error| format!("não foi possível preparar o download: {error}"))?;
    let response = client
        .get(parsed.clone())
        .send()
        .await
        .map_err(|error| format!("não foi possível acessar o arquivo: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "o servidor respondeu com o status {}",
            response.status()
        ));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_DOWNLOAD_BYTES)
    {
        return Err("o arquivo ultrapassa o limite de 220 MB".to_string());
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(str::to_string);
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("o download foi interrompido: {error}"))?;
    if bytes.len() as u64 > MAX_DOWNLOAD_BYTES {
        return Err("o arquivo ultrapassa o limite de 220 MB".to_string());
    }

    let suggested_name = parsed
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .filter(|segment| !segment.is_empty())
        .unwrap_or("música-baixada");
    let extension = extension_from_name(suggested_name)
        .or_else(|| {
            content_type
                .as_deref()
                .and_then(extension_from_mime)
                .map(str::to_string)
        })
        .or_else(|| {
            infer::get(&bytes)
                .and_then(|kind| extension_from_mime(kind.mime_type()).map(str::to_string))
        })
        .ok_or_else(|| "o link não aponta para um áudio ou vídeo compatível".to_string())?;

    let id = Uuid::new_v4();
    let paths = app_paths(&app)?;
    let destination_path = paths.media.join(format!("{id}.{extension}"));
    fs::write(&destination_path, &bytes)
        .map_err(|error| format!("não foi possível salvar o download: {error}"))?;
    let display_name = if extension_from_name(suggested_name).is_some() {
        clean_file_name(suggested_name)
    } else {
        format!("{}.{extension}", clean_file_name(suggested_name))
    };
    let track = TrackRecord {
        id: id.to_string(),
        title: title_from_name(&display_name),
        artist: "Download autorizado".to_string(),
        album: "Links diretos".to_string(),
        duration_seconds: 0,
        file_path: destination_path.to_string_lossy().into_owned(),
        file_name: display_name,
        source: "direct".to_string(),
        source_url: Some(parsed.to_string()),
        is_liked: false,
        is_favorite: false,
        cover_seed: cover_seed(&id),
    };
    let connection = open_database(&app)?;
    if let Err(error) = insert_track(&connection, &track) {
        let _ = fs::remove_file(&track.file_path);
        return Err(error);
    }
    Ok(track)
}

#[tauri::command]
pub fn set_track_liked(app: tauri::AppHandle, track_id: String, value: bool) -> Result<(), String> {
    open_database(&app)?
        .execute(
            "UPDATE tracks SET is_liked = ?1 WHERE id = ?2",
            rusqlite::params![i64::from(value), track_id],
        )
        .map_err(|error| format!("não foi possível atualizar a música: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn set_track_favorite(
    app: tauri::AppHandle,
    track_id: String,
    value: bool,
) -> Result<(), String> {
    open_database(&app)?
        .execute(
            "UPDATE tracks SET is_favorite = ?1 WHERE id = ?2",
            rusqlite::params![i64::from(value), track_id],
        )
        .map_err(|error| format!("não foi possível atualizar a música: {error}"))?;
    Ok(())
}

fn managed_media_file(media_root: &Path, file_path: &Path) -> Result<Option<PathBuf>, String> {
    let metadata = match fs::metadata(file_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "não foi possível verificar o arquivo que será excluído: {error}"
            ));
        }
    };
    if !metadata.is_file() {
        return Err("a mídia salva não é um arquivo regular e não pode ser excluída".to_string());
    }

    let canonical_root = fs::canonicalize(media_root)
        .map_err(|error| format!("não foi possível validar a biblioteca local: {error}"))?;
    let canonical_file = fs::canonicalize(file_path)
        .map_err(|error| format!("não foi possível validar o arquivo salvo: {error}"))?;
    if !canonical_file.starts_with(&canonical_root) {
        return Err(
            "a exclusão foi recusada porque o arquivo não pertence à biblioteca privada do Naki"
                .to_string(),
        );
    }

    Ok(Some(canonical_file))
}

fn reconcile_deleting_files(media_root: &Path, live_file_names: &HashSet<OsString>) {
    let Ok(entries) = fs::read_dir(media_root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let is_pending_file = path
            .extension()
            .is_some_and(|extension| extension == "deleting")
            && entry.file_type().is_ok_and(|file_type| file_type.is_file());
        if !is_pending_file {
            continue;
        }
        let Some(pending_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Some(original_name) = pending_name
            .strip_prefix('.')
            .and_then(|name| name.strip_suffix(".deleting"))
            .filter(|name| !name.is_empty())
        else {
            continue;
        };
        let original_path = media_root.join(original_name);
        if live_file_names.contains(OsStr::new(original_name)) && !original_path.exists() {
            let _ = rename_with_release_retry(&path, &original_path);
        } else {
            let _ = fs::remove_file(path);
        }
    }
}

fn rename_with_release_retry(source: &Path, destination: &Path) -> io::Result<()> {
    const RETRIES: usize = 4;
    for attempt in 0..RETRIES {
        match fs::rename(source, destination) {
            Ok(()) => return Ok(()),
            Err(error)
                if error.kind() == io::ErrorKind::PermissionDenied && attempt + 1 < RETRIES =>
            {
                thread::sleep(Duration::from_millis(45));
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!("the rename retry loop always returns")
}

fn delete_track_from_storage(
    connection: &mut Connection,
    media_root: &Path,
    track_id: &str,
) -> Result<(), String> {
    let stored_path = connection
        .query_row(
            "SELECT file_path FROM tracks WHERE id = ?1",
            [track_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("não foi possível localizar a música: {error}"))?
        .ok_or_else(|| "essa música já não existe na biblioteca".to_string())?;

    let managed_file = managed_media_file(media_root, Path::new(&stored_path))?;
    let pending_path = managed_file
        .as_ref()
        .map(|file_path| {
            file_path
                .file_name()
                .map(|name| media_root.join(format!(".{}.deleting", name.to_string_lossy())))
                .ok_or_else(|| "o nome do arquivo salvo é inválido".to_string())
        })
        .transpose()?;

    if let (Some(file_path), Some(pending_path)) = (&managed_file, &pending_path) {
        rename_with_release_retry(file_path, pending_path).map_err(|error| {
            format!("não foi possível liberar o arquivo para exclusão: {error}")
        })?;
    }

    let database_result = (|| -> Result<(), String> {
        let transaction = connection
            .transaction()
            .map_err(|error| format!("não foi possível iniciar a exclusão: {error}"))?;
        let affected_rows = transaction
            .execute("DELETE FROM tracks WHERE id = ?1", [track_id])
            .map_err(|error| format!("não foi possível excluir a música: {error}"))?;
        if affected_rows != 1 {
            return Err("essa música já não existe na biblioteca".to_string());
        }
        transaction
            .commit()
            .map_err(|error| format!("não foi possível salvar a exclusão: {error}"))?;
        Ok(())
    })();

    if let Err(error) = database_result {
        if let (Some(file_path), Some(pending_path)) = (&managed_file, &pending_path) {
            if let Err(restore_error) = rename_with_release_retry(pending_path, file_path) {
                return Err(format!(
                    "{error}. A cópia da mídia também não pôde ser restaurada automaticamente: {restore_error}"
                ));
            }
        }
        return Err(error);
    }

    if let Some(pending_path) = pending_path {
        if let Err(error) = fs::remove_file(&pending_path) {
            eprintln!(
                "aviso: a mídia excluída ficou pendente de limpeza em {}: {error}",
                pending_path.display()
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub fn delete_track(app: tauri::AppHandle, track_id: String) -> Result<(), String> {
    let paths = app_paths(&app)?;
    let mut connection = open_database(&app)?;
    delete_track_from_storage(&mut connection, &paths.media, &track_id)
}

#[tauri::command]
pub fn create_playlist(app: tauri::AppHandle, name: String) -> Result<PlaylistRecord, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err("o nome da playlist deve ter entre 1 e 80 caracteres".to_string());
    }
    let id = Uuid::new_v4().to_string();
    open_database(&app)?
        .execute(
            "INSERT INTO playlists (id, name, created_at)
             VALUES (?1, ?2, CAST(strftime('%s', 'now') AS INTEGER))",
            rusqlite::params![id, name],
        )
        .map_err(|error| format!("não foi possível criar a playlist: {error}"))?;
    Ok(PlaylistRecord {
        id,
        name: name.to_string(),
        track_ids: Vec::new(),
    })
}

#[tauri::command]
pub fn add_track_to_playlist(
    app: tauri::AppHandle,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    open_database(&app)?
        .execute(
            "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
             VALUES (
               ?1, ?2,
               COALESCE((SELECT MAX(position) + 1 FROM playlist_tracks WHERE playlist_id = ?1), 0)
             )",
            rusqlite::params![playlist_id, track_id],
        )
        .map_err(|error| format!("não foi possível adicionar à playlist: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn remove_track_from_playlist(
    app: tauri::AppHandle,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    open_database(&app)?
        .execute(
            "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
            rusqlite::params![playlist_id, track_id],
        )
        .map_err(|error| format!("não foi possível remover da playlist: {error}"))?;
    Ok(())
}

fn playlist_order_is_valid(existing: &[String], requested: &[String]) -> bool {
    if existing.len() != requested.len() {
        return false;
    }
    let requested_ids = requested.iter().map(String::as_str).collect::<HashSet<_>>();
    requested_ids.len() == requested.len()
        && existing
            .iter()
            .all(|track_id| requested_ids.contains(track_id.as_str()))
}

#[tauri::command]
pub fn reorder_playlist_tracks(
    app: tauri::AppHandle,
    playlist_id: String,
    track_ids: Vec<String>,
) -> Result<(), String> {
    let mut connection = open_database(&app)?;
    let existing = {
        let mut statement = connection
            .prepare(
                "SELECT track_id FROM playlist_tracks
                 WHERE playlist_id = ?1 ORDER BY position ASC",
            )
            .map_err(|error| format!("não foi possível consultar a playlist: {error}"))?;
        let rows = statement
            .query_map([&playlist_id], |row| row.get::<_, String>(0))
            .map_err(|error| format!("não foi possível ler a playlist: {error}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("não foi possível montar a playlist: {error}"))?
    };

    if !playlist_order_is_valid(&existing, &track_ids) {
        return Err("a nova ordem precisa conter exatamente as músicas da playlist".to_string());
    }

    let transaction = connection
        .transaction()
        .map_err(|error| format!("não foi possível iniciar a reordenação: {error}"))?;
    for (position, track_id) in track_ids.iter().enumerate() {
        transaction
            .execute(
                "UPDATE playlist_tracks SET position = ?1
                 WHERE playlist_id = ?2 AND track_id = ?3",
                rusqlite::params![position as i64, playlist_id, track_id],
            )
            .map_err(|error| format!("não foi possível reordenar a playlist: {error}"))?;
    }
    transaction
        .commit()
        .map_err(|error| format!("não foi possível salvar a nova ordem: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn supported_media_extensions() -> Vec<&'static str> {
    SUPPORTED_EXTENSIONS.to_vec()
}

#[cfg(test)]
mod tests {
    use super::{
        delete_track_from_storage, managed_media_file, playlist_order_is_valid,
        reconcile_deleting_files,
    };
    use rusqlite::Connection;
    use std::{ffi::OsString, fs, path::PathBuf};
    use uuid::Uuid;

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    fn delete_test_root() -> (PathBuf, PathBuf) {
        let test_root = std::env::temp_dir().join(format!("naki-play-delete-{}", Uuid::new_v4()));
        let media_root = test_root.join("media");
        fs::create_dir_all(&media_root).expect("create media test folder");
        (test_root, media_root)
    }

    fn delete_test_database(track_path: &std::path::Path) -> Connection {
        let connection = Connection::open_in_memory().expect("open test database");
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE tracks (id TEXT PRIMARY KEY, file_path TEXT NOT NULL);
                 CREATE TABLE playlists (id TEXT PRIMARY KEY);
                 CREATE TABLE playlist_tracks (
                   playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                   track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                   PRIMARY KEY (playlist_id, track_id)
                 );
                 INSERT INTO playlists (id) VALUES ('playlist');",
            )
            .expect("create test schema");
        connection
            .execute(
                "INSERT INTO tracks (id, file_path) VALUES ('track', ?1)",
                [track_path.to_string_lossy().as_ref()],
            )
            .expect("insert test track");
        connection
            .execute(
                "INSERT INTO playlist_tracks (playlist_id, track_id) VALUES ('playlist', 'track')",
                [],
            )
            .expect("insert test playlist track");
        connection
    }

    fn row_count(connection: &Connection, table: &str) -> i64 {
        connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .expect("count test rows")
    }

    #[test]
    fn accepts_the_same_playlist_in_another_order() {
        assert!(playlist_order_is_valid(
            &ids(&["a", "b", "c"]),
            &ids(&["c", "a", "b"]),
        ));
    }

    #[test]
    fn rejects_missing_or_duplicated_tracks() {
        assert!(!playlist_order_is_valid(
            &ids(&["a", "b", "c"]),
            &ids(&["a", "b"]),
        ));
        assert!(!playlist_order_is_valid(
            &ids(&["a", "b", "c"]),
            &ids(&["a", "a", "c"]),
        ));
    }

    #[test]
    fn only_accepts_existing_files_inside_the_private_media_folder() {
        let (test_root, media_root) = delete_test_root();
        let managed_file = media_root.join("inside.mp3");
        let external_file = test_root.join("outside.mp3");
        fs::write(&managed_file, b"managed").expect("create managed test file");
        fs::write(&external_file, b"external").expect("create external test file");

        assert!(managed_media_file(&media_root, &managed_file)
            .expect("managed path validation")
            .is_some());
        assert!(managed_media_file(&media_root, &external_file).is_err());
        assert!(
            managed_media_file(&media_root, &media_root.join("missing.mp3"))
                .expect("missing path validation")
                .is_none()
        );

        fs::remove_file(managed_file).expect("remove managed test file");
        fs::remove_file(external_file).expect("remove external test file");
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }

    #[test]
    fn deletes_the_private_file_track_and_playlist_links() {
        let (test_root, media_root) = delete_test_root();
        let managed_file = media_root.join("track.mp3");
        fs::write(&managed_file, b"managed").expect("create managed test file");
        let mut connection = delete_test_database(&managed_file);

        delete_track_from_storage(&mut connection, &media_root, "track")
            .expect("delete managed track");

        assert!(!managed_file.exists());
        assert_eq!(row_count(&connection, "tracks"), 0);
        assert_eq!(row_count(&connection, "playlist_tracks"), 0);
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }

    #[test]
    fn removes_metadata_when_the_private_file_is_already_missing() {
        let (test_root, media_root) = delete_test_root();
        let mut connection = delete_test_database(&media_root.join("missing.mp3"));

        delete_track_from_storage(&mut connection, &media_root, "track")
            .expect("delete missing track metadata");

        assert_eq!(row_count(&connection, "tracks"), 0);
        assert_eq!(row_count(&connection, "playlist_tracks"), 0);
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }

    #[test]
    fn refuses_an_external_file_and_keeps_its_database_row() {
        let (test_root, media_root) = delete_test_root();
        let external_file = test_root.join("external.mp3");
        fs::write(&external_file, b"external").expect("create external test file");
        let mut connection = delete_test_database(&external_file);

        assert!(delete_track_from_storage(&mut connection, &media_root, "track").is_err());
        assert!(external_file.exists());
        assert_eq!(row_count(&connection, "tracks"), 1);
        assert_eq!(row_count(&connection, "playlist_tracks"), 1);
        fs::remove_file(external_file).expect("remove external test file");
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }

    #[test]
    fn restores_the_file_when_the_database_rejects_the_delete() {
        let (test_root, media_root) = delete_test_root();
        let managed_file = media_root.join("track.mp3");
        fs::write(&managed_file, b"managed").expect("create managed test file");
        let mut connection = delete_test_database(&managed_file);
        connection
            .execute_batch(
                "CREATE TRIGGER reject_track_delete BEFORE DELETE ON tracks
                 BEGIN SELECT RAISE(ABORT, 'blocked'); END;",
            )
            .expect("create rejection trigger");

        assert!(delete_track_from_storage(&mut connection, &media_root, "track").is_err());
        assert!(managed_file.exists());
        assert_eq!(row_count(&connection, "tracks"), 1);
        fs::remove_file(managed_file).expect("remove managed test file");
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }

    #[test]
    fn cleans_only_pending_deletion_files() {
        let (test_root, media_root) = delete_test_root();
        let pending_file = media_root.join(".removed.mp3.deleting");
        let regular_file = media_root.join("keep.mp3");
        fs::write(&pending_file, b"pending").expect("create pending test file");
        fs::write(&regular_file, b"regular").expect("create regular test file");

        reconcile_deleting_files(&media_root, &std::collections::HashSet::new());

        assert!(!pending_file.exists());
        assert!(regular_file.exists());
        fs::remove_file(regular_file).expect("remove regular test file");
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }

    #[test]
    fn restores_a_pending_file_when_its_database_record_still_exists() {
        let (test_root, media_root) = delete_test_root();
        let original_file = media_root.join("track.mp3");
        let pending_file = media_root.join(".track.mp3.deleting");
        fs::write(&pending_file, b"pending").expect("create pending test file");
        let live_file_names = [OsString::from("track.mp3")].into_iter().collect();

        reconcile_deleting_files(&media_root, &live_file_names);

        assert!(!pending_file.exists());
        assert!(original_file.exists());
        fs::remove_file(original_file).expect("remove restored test file");
        fs::remove_dir(media_root).expect("remove media test folder");
        fs::remove_dir(test_root).expect("remove test folder");
    }
}
