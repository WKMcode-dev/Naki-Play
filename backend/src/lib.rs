mod commands;
mod database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_naki_media::init())
        .invoke_handler(tauri::generate_handler![
            commands::catalog::rename_playlist,
            commands::catalog::delete_playlist,
            commands::catalog::update_track_metadata,
            commands::health::app_health,
            commands::library::add_track_to_playlist,
            commands::library::bootstrap_library,
            commands::library::create_playlist,
            commands::library::delete_track,
            commands::library::download_track_from_url,
            commands::library::import_tracks,
            commands::library::remove_track_from_playlist,
            commands::library::reorder_playlist_tracks,
            commands::library::set_track_favorite,
            commands::library::set_track_liked,
            commands::library::supported_media_extensions,
            commands::media::analyze_external_media,
            commands::media::cancel_external_download,
            commands::media::download_external_media,
            commands::settings::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("não foi possível iniciar o Naki Play");
}
