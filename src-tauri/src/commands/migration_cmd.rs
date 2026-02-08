use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::db::migration::{self, ImportResult};

#[tauri::command]
pub async fn import_data(state: State<'_, AppState>, json_content: String) -> AppResult<ImportResult> {
    let db = state.db.lock().await;
    migration::import_from_json_content(&db.conn, &json_content)
}

#[tauri::command]
pub async fn export_data(state: State<'_, AppState>) -> AppResult<String> {
    let db = state.db.lock().await;
    migration::export_to_json(&db.conn)
}
