use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    status: &'static str,
    version: &'static str,
}

#[tauri::command]
pub fn app_health() -> HealthStatus {
    HealthStatus {
        status: "ready",
        version: env!("CARGO_PKG_VERSION"),
    }
}
