use serde::de::DeserializeOwned;
use std::{
  collections::{HashMap, VecDeque},
  marker::PhantomData,
  path::PathBuf,
  sync::Mutex,
};
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

#[cfg(target_os = "windows")]
use std::{
  io::{BufRead, BufReader, Read},
  process::{Command, Stdio},
  sync::mpsc,
  thread,
  time::Duration,
};

#[cfg(debug_assertions)]
const WINDOWS_TARGET: &str = "x86_64-pc-windows-msvc";

/// Access to the desktop media engine.
pub struct NakiMedia<R: Runtime> {
  _runtime: PhantomData<fn() -> R>,
  active_processes: Mutex<HashMap<String, u32>>,
}

pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<NakiMedia<R>> {
  Ok(NakiMedia {
    _runtime: PhantomData,
    active_processes: Mutex::new(HashMap::new()),
  })
}

#[cfg(target_os = "windows")]
fn tool_path(name: &str) -> crate::Result<PathBuf> {
  let installed = std::env::current_exe()?
    .parent()
    .map(|directory| directory.join(format!("{name}.exe")));
  if let Some(path) = installed.filter(|path| path.is_file()) {
    return Ok(path);
  }

  #[cfg(debug_assertions)]
  {
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
      .join("binaries")
      .join(format!("{name}-{WINDOWS_TARGET}.exe"));
    if development.is_file() {
      return Ok(development);
    }
  }

  Err(crate::Error::Desktop(format!(
    "o componente {name} não foi encontrado; execute pnpm desktop:prepare"
  )))
}

#[cfg(target_os = "windows")]
fn hide_console(command: &mut Command) {
  use std::os::windows::process::CommandExt;
  command.creation_flags(0x0800_0000);
}

#[cfg(target_os = "windows")]
fn base_command() -> crate::Result<Command> {
  let yt_dlp = tool_path("yt-dlp")?;
  let deno = tool_path("deno")?;
  let ffmpeg = tool_path("ffmpeg")?;
  let mut command = Command::new(yt_dlp);
  command.args([
    "--ignore-config",
    "--no-colors",
    "--socket-timeout",
    "20",
    "--retries",
    "2",
    "--extractor-retries",
    "2",
    "--js-runtimes",
  ]);
  command.arg(format!("deno:{}", deno.to_string_lossy()));
  command.args(["--ffmpeg-location"]);
  command.arg(ffmpeg);
  hide_console(&mut command);
  Ok(command)
}

#[cfg(target_os = "windows")]
fn format_choices(max_height: i64) -> Vec<MediaFormatChoice> {
  let mut formats = [128, 192, 256, 320]
    .into_iter()
    .map(|bitrate| MediaFormatChoice {
      id: format!("audio-{bitrate}"),
      kind: "audio".to_string(),
      container: "mp3".to_string(),
      quality: bitrate.to_string(),
      label: format!("MP3 · {bitrate} kbps"),
    })
    .collect::<Vec<_>>();

  for height in [144_i64, 240, 360, 480, 720, 1080, 1440, 2160] {
    if height <= max_height {
      formats.push(MediaFormatChoice {
        id: format!("video-{height}"),
        kind: "video".to_string(),
        container: "mp4".to_string(),
        quality: height.to_string(),
        label: format!("MP4 · {height}p"),
      });
    }
  }
  formats
}

#[cfg(target_os = "windows")]
fn text_field(value: &serde_json::Value, names: &[&str]) -> Option<String> {
  names
    .iter()
    .find_map(|name| value.get(name).and_then(serde_json::Value::as_str))
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(str::to_string)
}

#[cfg(target_os = "windows")]
fn analysis_from_json(value: serde_json::Value, original_url: &str) -> crate::Result<MediaAnalysis> {
  let max_height = value
    .get("formats")
    .and_then(serde_json::Value::as_array)
    .into_iter()
    .flatten()
    .filter_map(|format| format.get("height").and_then(serde_json::Value::as_i64))
    .max()
    .or_else(|| value.get("height").and_then(serde_json::Value::as_i64))
    .unwrap_or(0)
    .clamp(0, 2160);

  Ok(MediaAnalysis {
    id: text_field(&value, &["id"]).unwrap_or_else(|| original_url.to_string()),
    title: text_field(&value, &["title", "fulltitle"])
      .unwrap_or_else(|| "Mídia sem título".to_string()),
    author: text_field(&value, &["uploader", "channel", "creator"])
      .unwrap_or_else(|| "Criador não informado".to_string()),
    thumbnail_url: text_field(&value, &["thumbnail"]),
    duration_seconds: value
      .get("duration")
      .and_then(serde_json::Value::as_f64)
      .unwrap_or(0.0)
      .max(0.0) as i64,
    webpage_url: text_field(&value, &["webpage_url", "original_url"])
      .unwrap_or_else(|| original_url.to_string()),
    provider: text_field(&value, &["extractor_key", "extractor"])
      .unwrap_or_else(|| "web".to_string()),
    formats: format_choices(max_height),
  })
}

#[cfg(target_os = "windows")]
fn output_error(stderr: &[u8], fallback: &str) -> crate::Error {
  let stderr_text = String::from_utf8_lossy(stderr);
  let message = stderr_text
    .lines()
    .rev()
    .find(|line| !line.trim().is_empty())
    .unwrap_or(fallback)
    .trim()
    .trim_start_matches("ERROR:")
    .trim();
  crate::Error::Desktop(message.chars().take(600).collect())
}

#[cfg(target_os = "windows")]
fn stream_reader<R: Read + Send + 'static>(reader: R, sender: mpsc::Sender<String>) -> thread::JoinHandle<()> {
  thread::spawn(move || {
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
      let _ = sender.send(line);
    }
  })
}

#[cfg(target_os = "windows")]
fn process_line(args: &DownloadRequest, line: &str, history: &mut VecDeque<String>) {
  if let Some(progress) = line.trim().strip_prefix("NAKI_PROGRESS:") {
    let mut values = progress.split('|');
    let percentage = values
      .next()
      .unwrap_or_default()
      .trim()
      .trim_end_matches('%')
      .replace(',', ".")
      .parse::<f64>()
      .unwrap_or(0.0)
      .clamp(0.0, 100.0);
    let eta_seconds = values
      .next()
      .unwrap_or_default()
      .trim()
      .parse::<i64>()
      .unwrap_or(0)
      .max(0);
    let _ = args.on_event.send(DownloadEvent::Progress {
      progress: percentage,
      eta_seconds,
      message: "Baixando a mídia…".to_string(),
    });
    return;
  }

  if ["[ExtractAudio]", "[Merger]", "[Metadata]", "[VideoConvertor]"]
    .iter()
    .any(|marker| line.contains(marker))
  {
    let _ = args.on_event.send(DownloadEvent::Converting {
      message: "Finalizando e convertendo o arquivo…".to_string(),
    });
  }

  let clean = line.trim();
  if !clean.is_empty() {
    if history.len() == 30 {
      history.pop_front();
    }
    history.push_back(clean.chars().take(600).collect());
  }
}

impl<R: Runtime> NakiMedia<R> {
  pub fn analyze(&self, payload: AnalyzeRequest) -> crate::Result<MediaAnalysis> {
    #[cfg(target_os = "windows")]
    {
      let mut command = base_command()?;
      command.args([
        "--no-playlist",
        "--no-warnings",
        "--skip-download",
        "--dump-single-json",
        "--",
      ]);
      command.arg(&payload.url);
      let output = command.output()?;
      if !output.status.success() {
        return Err(output_error(&output.stderr, "não foi possível analisar esse link"));
      }
      let value = serde_json::from_slice(&output.stdout)
        .map_err(|error| crate::Error::Desktop(format!("a origem retornou metadados inválidos: {error}")))?;
      return analysis_from_json(value, &payload.url);
    }

    #[cfg(not(target_os = "windows"))]
    {
      let _ = payload;
      Err(crate::Error::UnsupportedPlatform)
    }
  }

  pub fn download(&self, payload: DownloadRequest) -> crate::Result<DownloadResponse> {
    #[cfg(target_os = "windows")]
    {
      let selected = payload
        .option_id
        .split_once('-')
        .and_then(|(kind, quality)| quality.parse::<i64>().ok().map(|quality| (kind, quality)))
        .ok_or_else(|| crate::Error::Desktop("escolha de formato inválida".to_string()))?;
      let (kind, quality) = selected;
      let extension = match kind {
        "audio" if [128, 192, 256, 320].contains(&quality) => "mp3",
        "video" if [144, 240, 360, 480, 720, 1080, 1440, 2160].contains(&quality) => "mp4",
        _ => return Err(crate::Error::Desktop("qualidade inválida".to_string())),
      };
      let destination = PathBuf::from(&payload.destination_stem);
      if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
      }
      let _ = payload.on_event.send(DownloadEvent::Preparing {
        message: "Preparando o motor do Windows…".to_string(),
      });

      let mut command = base_command()?;
      command.args([
        "--no-playlist",
        "--newline",
        "--no-mtime",
        "--no-warnings",
        "--embed-metadata",
        "--progress-template",
        "download:NAKI_PROGRESS:%(progress._percent_str)s|%(progress.eta)s",
        "-o",
      ]);
      command.arg(format!("{}.%(ext)s", destination.to_string_lossy()));
      if extension == "mp3" {
        command.args([
          "-f",
          "bestaudio/best",
          "--extract-audio",
          "--audio-format",
          "mp3",
          "--audio-quality",
        ]);
        command.arg(format!("{quality}K"));
      } else {
        command.args(["-f"]);
        command.arg(format!(
          "bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best[height<={quality}]/best[ext=mp4]/best"
        ));
        command.args(["--merge-output-format", "mp4"]);
      }
      command.args(["--"]);
      command.arg(&payload.url);
      command.stdout(Stdio::piped()).stderr(Stdio::piped());

      let mut child = command.spawn()?;
      let pid = child.id();
      {
        let mut active = self.active_processes.lock().map_err(|_| {
          crate::Error::Desktop("não foi possível registrar o download".to_string())
        })?;
        if active.insert(payload.job_id.clone(), pid).is_some() {
          let _ = child.kill();
          return Err(crate::Error::Desktop("esse download já está em andamento".to_string()));
        }
      }

      let (sender, receiver) = mpsc::channel();
      let stdout_thread = child.stdout.take().map(|stream| stream_reader(stream, sender.clone()));
      let stderr_thread = child.stderr.take().map(|stream| stream_reader(stream, sender));
      let mut history = VecDeque::new();
      let status = loop {
        match receiver.recv_timeout(Duration::from_millis(100)) {
          Ok(line) => process_line(&payload, &line, &mut history),
          Err(mpsc::RecvTimeoutError::Timeout) => {}
          Err(mpsc::RecvTimeoutError::Disconnected) => {}
        }
        if let Some(status) = child.try_wait()? {
          break status;
        }
      };
      if let Some(handle) = stdout_thread {
        let _ = handle.join();
      }
      if let Some(handle) = stderr_thread {
        let _ = handle.join();
      }
      while let Ok(line) = receiver.try_recv() {
        process_line(&payload, &line, &mut history);
      }
      if let Ok(mut active) = self.active_processes.lock() {
        active.remove(&payload.job_id);
      }

      if !status.success() {
        let message = history
          .iter()
          .rev()
          .find(|line| line.contains("ERROR") || line.contains("error"))
          .or_else(|| history.back())
          .map(String::as_str)
          .unwrap_or("o download não pôde ser concluído")
          .trim_start_matches("ERROR:")
          .trim();
        return Err(crate::Error::Desktop(message.to_string()));
      }

      let output = destination.with_extension(extension);
      if !output.is_file() || output.metadata()?.len() == 0 {
        return Err(crate::Error::Desktop(
          "o processamento terminou sem gerar o arquivo esperado".to_string(),
        ));
      }
      let output_path = output.to_string_lossy().into_owned();
      let _ = payload.on_event.send(DownloadEvent::Finished {
        file_path: output_path.clone(),
      });
      return Ok(DownloadResponse {
        file_path: output_path,
        file_name: format!("{}.{}", payload.title, extension),
        title: payload.title,
        author: payload.author,
        duration_seconds: payload.duration_seconds,
      });
    }

    #[cfg(not(target_os = "windows"))]
    {
      let _ = payload;
      Err(crate::Error::UnsupportedPlatform)
    }
  }

  pub fn cancel(&self, payload: CancelRequest) -> crate::Result<CancelResponse> {
    #[cfg(target_os = "windows")]
    {
      let pid = self
        .active_processes
        .lock()
        .map_err(|_| crate::Error::Desktop("não foi possível acessar o download".to_string()))?
        .remove(&payload.job_id);
      let Some(pid) = pid else {
        return Ok(CancelResponse { cancelled: false });
      };
      let mut command = Command::new("taskkill");
      command.args(["/PID", &pid.to_string(), "/T", "/F"]);
      hide_console(&mut command);
      let status = command.status()?;
      return Ok(CancelResponse {
        cancelled: status.success(),
      });
    }

    #[cfg(not(target_os = "windows"))]
    {
      let _ = payload;
      Ok(CancelResponse { cancelled: false })
    }
  }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
  use super::{analysis_from_json, format_choices};

  #[test]
  fn creates_only_available_video_resolutions() {
    let formats = format_choices(1080);
    assert!(formats.iter().any(|format| format.id == "audio-320"));
    assert!(formats.iter().any(|format| format.id == "video-1080"));
    assert!(!formats.iter().any(|format| format.id == "video-1440"));
  }

  #[test]
  fn maps_ytdlp_metadata() {
    let value = serde_json::json!({
      "id": "abc",
      "title": "Uma música",
      "uploader": "Uma pessoa",
      "duration": 42.7,
      "webpage_url": "https://example.com/watch/abc",
      "extractor_key": "Youtube",
      "formats": [{ "height": 720 }, { "height": 1080 }]
    });
    let analysis = analysis_from_json(value, "https://example.com").unwrap();
    assert_eq!(analysis.id, "abc");
    assert_eq!(analysis.duration_seconds, 42);
    assert!(analysis.formats.iter().any(|format| format.id == "video-1080"));
  }
}
