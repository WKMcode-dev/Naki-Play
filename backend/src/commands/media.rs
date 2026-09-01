use crate::database::{app_paths, insert_track, open_database, TrackRecord};
use serde::Deserialize;
use std::{fs, path::Path};
use tauri::ipc::Channel;
use tauri_plugin_naki_media::{
    AnalyzeRequest, CancelRequest, DownloadEvent, DownloadRequest, MediaAnalysis, NakiMediaExt,
};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDownloadSelection {
    pub url: String,
    pub option_id: String,
    pub title: String,
    pub author: String,
    pub duration_seconds: i64,
    pub provider: String,
    pub job_id: String,
    pub confirmed_authorized: bool,
}

fn validate_url(value: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(value.trim())
        .map_err(|_| "cole um link válido começando com http:// ou https://".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("somente links http:// e https:// são aceitos".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("links com usuário ou senha não são aceitos".to_string());
    }
    Ok(())
}

fn display_file_name(title: &str, extension: &str) -> String {
    let title = title
        .chars()
        .filter(|character| !character.is_control())
        .take(170)
        .collect::<String>();
    let title = title.trim();
    format!(
        "{}.{}",
        if title.is_empty() {
            "Mídia baixada"
        } else {
            title
        },
        extension
    )
}

fn cleanup_job_files(media_dir: &Path, id: &Uuid) {
    let prefix = format!("{id}.");
    if let Ok(entries) = fs::read_dir(media_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with(&prefix) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

#[tauri::command]
pub async fn analyze_external_media(
    app: tauri::AppHandle,
    url: String,
) -> Result<MediaAnalysis, String> {
    validate_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.naki_media()
            .analyze(AnalyzeRequest { url })
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("a análise foi interrompida: {error}"))?
}

#[tauri::command]
pub async fn download_external_media(
    app: tauri::AppHandle,
    selection: MediaDownloadSelection,
    on_event: Channel<DownloadEvent>,
) -> Result<TrackRecord, String> {
    validate_url(&selection.url)?;
    if !selection.confirmed_authorized {
        return Err("confirme que você possui autorização para salvar esse conteúdo".to_string());
    }
    if selection.title.trim().is_empty() || selection.title.chars().count() > 300 {
        return Err("o título retornado pela origem é inválido".to_string());
    }
    if selection.author.chars().count() > 200 {
        return Err("o nome do criador retornado pela origem é inválido".to_string());
    }
    let job_id = Uuid::parse_str(&selection.job_id)
        .map_err(|_| "o identificador do download é inválido".to_string())?;
    let track_id = Uuid::new_v4();
    let paths = app_paths(&app)?;
    let destination_stem = paths.media.join(track_id.to_string());
    let plugin_request = DownloadRequest {
        url: selection.url.clone(),
        destination_stem: destination_stem.to_string_lossy().into_owned(),
        job_id: job_id.to_string(),
        option_id: selection.option_id.clone(),
        title: selection.title.clone(),
        author: selection.author.clone(),
        duration_seconds: selection.duration_seconds.max(0),
        on_event,
    };
    let plugin_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        plugin_app
            .naki_media()
            .download(plugin_request)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("o download foi interrompido: {error}"))?;

    let downloaded = match result {
        Ok(downloaded) => downloaded,
        Err(error) => {
            cleanup_job_files(&paths.media, &track_id);
            return Err(error);
        }
    };
    let canonical_media = fs::canonicalize(&paths.media)
        .map_err(|error| format!("não foi possível validar a biblioteca: {error}"))?;
    let canonical_file = fs::canonicalize(&downloaded.file_path)
        .map_err(|error| format!("o arquivo final não foi encontrado: {error}"))?;
    if !canonical_file.starts_with(&canonical_media) || !canonical_file.is_file() {
        cleanup_job_files(&paths.media, &track_id);
        return Err("o motor retornou um arquivo fora da biblioteca privada".to_string());
    }
    let extension = canonical_file
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "mp3" | "mp4") {
        cleanup_job_files(&paths.media, &track_id);
        return Err("o motor retornou um formato inesperado".to_string());
    }
    let provider = selection.provider.to_ascii_lowercase();
    let source = if provider.contains("youtube") {
        "youtube"
    } else {
        "direct"
    };
    let track = TrackRecord {
        id: track_id.to_string(),
        title: downloaded.title,
        artist: if downloaded.author.trim().is_empty() {
            "Criador não informado".to_string()
        } else {
            downloaded.author
        },
        album: "Downloads da Naki".to_string(),
        duration_seconds: downloaded.duration_seconds.max(0),
        file_path: canonical_file.to_string_lossy().into_owned(),
        file_name: display_file_name(&selection.title, &extension),
        source: source.to_string(),
        source_url: Some(selection.url),
        is_liked: false,
        is_favorite: false,
        cover_seed: (track_id.as_u128() % 8) as i64,
    };
    let connection = open_database(&app)?;
    if let Err(error) = insert_track(&connection, &track) {
        cleanup_job_files(&paths.media, &track_id);
        return Err(error);
    }
    Ok(track)
}

#[tauri::command]
pub async fn cancel_external_download(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<bool, String> {
    let job_id = Uuid::parse_str(&job_id)
        .map_err(|_| "o identificador do download é inválido".to_string())?
        .to_string();
    tauri::async_runtime::spawn_blocking(move || {
        app.naki_media()
            .cancel(CancelRequest { job_id })
            .map(|response| response.cancelled)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| format!("o cancelamento foi interrompido: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::{display_file_name, validate_url};

    #[test]
    fn accepts_http_urls_with_a_host() {
        assert!(validate_url("https://www.youtube.com/watch?v=example").is_ok());
        assert!(validate_url("http://example.com/media").is_ok());
    }

    #[test]
    fn rejects_non_http_and_credential_urls() {
        assert!(validate_url("file:///tmp/song.mp3").is_err());
        assert!(validate_url("https://user:secret@example.com/media").is_err());
        assert!(validate_url("não é um link").is_err());
    }

    #[test]
    fn creates_a_safe_display_name() {
        assert_eq!(display_file_name(" Minha\nMúsica ", "mp3"), "MinhaMúsica.mp3");
        assert_eq!(display_file_name("\n", "mp4"), "Mídia baixada.mp4");
    }
}
