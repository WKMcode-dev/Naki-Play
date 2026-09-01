use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_naki_media);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<NakiMedia<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.nakiplay.media", "NakiMediaPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_naki_media)?;
  Ok(NakiMedia(handle))
}

/// Access to the naki-media APIs.
pub struct NakiMedia<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> NakiMedia<R> {
  pub fn analyze(&self, payload: AnalyzeRequest) -> crate::Result<MediaAnalysis> {
    self.0.run_mobile_plugin("analyze", payload).map_err(Into::into)
  }

  pub fn download(&self, payload: DownloadRequest) -> crate::Result<DownloadResponse> {
    self.0.run_mobile_plugin("download", payload).map_err(Into::into)
  }

  pub fn cancel(&self, payload: CancelRequest) -> crate::Result<CancelResponse> {
    self.0.run_mobile_plugin("cancel", payload).map_err(Into::into)
  }
}
