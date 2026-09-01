use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeRequest {
  pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFormatChoice {
  pub id: String,
  pub kind: String,
  pub container: String,
  pub quality: String,
  pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAnalysis {
  pub id: String,
  pub title: String,
  pub author: String,
  pub thumbnail_url: Option<String>,
  pub duration_seconds: i64,
  pub webpage_url: String,
  pub provider: String,
  pub formats: Vec<MediaFormatChoice>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum DownloadEvent {
  Preparing {
    message: String,
  },
  Progress {
    progress: f64,
    eta_seconds: i64,
    message: String,
  },
  Converting {
    message: String,
  },
  Finished {
    file_path: String,
  },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
  pub url: String,
  pub destination_stem: String,
  pub job_id: String,
  pub option_id: String,
  pub title: String,
  pub author: String,
  pub duration_seconds: i64,
  pub on_event: Channel<DownloadEvent>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResponse {
  pub file_path: String,
  pub file_name: String,
  pub title: String,
  pub author: String,
  pub duration_seconds: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelRequest {
  pub job_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelResponse {
  pub cancelled: bool,
}
