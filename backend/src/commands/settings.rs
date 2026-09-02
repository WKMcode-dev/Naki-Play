use crate::database::{load_settings, open_database, AppSettings};

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    let user_name = settings.user_name.trim();
    let app_title = settings.app_title.trim();
    if user_name.is_empty() || user_name.chars().count() > 60 {
        return Err("o nome de usuário deve ter entre 1 e 60 caracteres".to_string());
    }
    if app_title.is_empty() || app_title.chars().count() > 40 {
        return Err("o título deve ter entre 1 e 40 caracteres".to_string());
    }
    if !matches!(settings.theme_mode.as_str(), "light" | "dark" | "system") {
        return Err("o modo de tema informado é inválido".to_string());
    }
    if !matches!(settings.repeat_mode.as_str(), "off" | "all" | "one") {
        return Err("o modo de repetição informado é inválido".to_string());
    }
    for color in [
        &settings.primary_color,
        &settings.accent_color,
        &settings.light_background,
        &settings.dark_background,
    ] {
        if !valid_hex_color(color) {
            return Err("uma das cores informadas é inválida".to_string());
        }
    }

    let volume = settings.volume.clamp(0.0, 1.0);
    let connection = open_database(&app)?;
    connection
        .execute(
            "UPDATE settings SET
               user_name = ?1,
               app_title = ?2,
               theme_mode = ?3,
               primary_color = ?4,
               accent_color = ?5,
               light_background = ?6,
               dark_background = ?7,
               reduce_motion = ?8,
               compact_mode = ?9,
               autoplay = ?10,
               shuffle_enabled = ?11,
               repeat_mode = ?12,
               volume = ?13
             WHERE id = 1",
            rusqlite::params![
                user_name,
                app_title,
                settings.theme_mode,
                settings.primary_color,
                settings.accent_color,
                settings.light_background,
                settings.dark_background,
                i64::from(settings.reduce_motion),
                i64::from(settings.compact_mode),
                i64::from(settings.autoplay),
                i64::from(settings.shuffle_enabled),
                settings.repeat_mode,
                volume,
            ],
        )
        .map_err(|error| format!("não foi possível salvar as configurações: {error}"))?;

    load_settings(&connection)
}
