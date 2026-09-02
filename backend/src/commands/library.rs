use crate::database::{
    app_paths, insert_track, load_snapshot, open_database, AppSnapshot, PlaylistRecord, TrackRecord,
};
use serde::Deserialize;
use std::{
    collections::HashSet,
    fs,
    io::{self, Write},
    path::Path,
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
    load_snapshot(&app)
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
    use super::playlist_order_is_valid;

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
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
}
