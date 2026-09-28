use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioControlRequest {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    track_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    current_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    position_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    playing: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    volume: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    repeat_one: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    shuffle: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    autoplay: Option<bool>,
}

impl AudioControlRequest {
    fn validate(&self) -> Result<(), String> {
        if !matches!(self.action.as_str(), "inspect" | "load" | "status" | "play" | "pause" | "seek" | "next" | "previous" | "options" | "clear") {
            return Err("comando de reprodução inválido".into());
        }
        if self.position_ms.is_some_and(|v| v < 0) || self.volume.is_some_and(|v| !v.is_finite() || !(0.0..=1.0).contains(&v)) {
            return Err("posição ou volume de reprodução inválido".into());
        }
        if let Some(ids) = &self.track_ids {
            let unique: std::collections::HashSet<_> = ids.iter().collect();
            if ids.len() > 2000 || unique.len() != ids.len() { return Err("fila inválida ou maior que 2000 arquivos".into()); }
            if self.current_id.as_ref().is_some_and(|id| !ids.contains(id)) { return Err("a música atual não pertence à fila".into()); }
        }
        if self.action == "load" && self.track_ids.as_ref().is_none_or(|ids| ids.is_empty()) {
            return Err("a fila está vazia".into());
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn audio_playback(app: tauri::AppHandle, request: AudioControlRequest) -> Result<serde_json::Value, String> {
    request.validate()?;
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_naki_media::NakiMediaExt;
        tauri::async_runtime::spawn_blocking(move || {
            let mut payload = serde_json::to_value(&request).map_err(|e| e.to_string())?;
            if let Some(ids) = &request.track_ids {
                let connection = crate::database::open_database(&app)?;
                let root = std::fs::canonicalize(crate::database::app_paths(&app)?.media).map_err(|e| e.to_string())?;
                let mut queue = Vec::new();
                for id in ids {
                    let (path, title, artist): (String, String, String) = connection.query_row(
                        "SELECT file_path, title, artist FROM tracks WHERE id = ?1", [id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    ).map_err(|_| "a música não foi encontrada na biblioteca".to_string())?;
                    // JS supplies only IDs; local file paths are resolved from the private catalog.
                    let canonical = std::fs::canonicalize(&path).map_err(|_| "o arquivo salvo não está disponível; importe-o novamente".to_string())?;
                    if canonical.parent() != Some(root.as_path()) || !canonical.is_file() { return Err("arquivo fora da biblioteca privada".into()); }
                    queue.push(serde_json::json!({"id": id, "path": canonical.to_string_lossy(), "title": title, "artist": artist}));
                }
                payload["queue"] = serde_json::Value::Array(queue);
            }
            app.naki_media().audio_command(payload).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "android"))]
    { let _ = app; Err("o player nativo está disponível no Android".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(value: serde_json::Value) -> AudioControlRequest { serde_json::from_value(value).unwrap() }
    #[test] fn playback_boundary_rejects_invalid_commands_and_queues() {
        for value in [serde_json::json!({"action":"execute"}), serde_json::json!({"action":"load"}), serde_json::json!({"action":"seek","positionMs":-1}), serde_json::json!({"action":"options","volume":2}), serde_json::json!({"action":"load","trackIds":["a","a"]}), serde_json::json!({"action":"load","trackIds":["a"],"currentId":"b"})] {
            assert!(request(value).validate().is_err());
        }
        assert!(request(serde_json::json!({"action":"load","trackIds":["a"],"currentId":"a","volume":0})).validate().is_ok());
    }
    #[test] fn omitted_options_remain_omitted_in_mobile_payload() {
        let value = serde_json::to_value(request(serde_json::json!({"action":"status"}))).unwrap();
        assert_eq!(value, serde_json::json!({"action":"status"}));
    }
}
