use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::NakiMedia;
#[cfg(mobile)]
use mobile::NakiMedia;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the naki-media APIs.
pub trait NakiMediaExt<R: Runtime> {
  fn naki_media(&self) -> &NakiMedia<R>;
}

impl<R: Runtime, T: Manager<R>> crate::NakiMediaExt<R> for T {
  fn naki_media(&self) -> &NakiMedia<R> {
    self.state::<NakiMedia<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("naki-media")
    .setup(|app, api| {
      #[cfg(mobile)]
      let naki_media = mobile::init(app, api)?;
      #[cfg(desktop)]
      let naki_media = desktop::init(app, api)?;
      app.manage(naki_media);
      Ok(())
    })
    .build()
}
