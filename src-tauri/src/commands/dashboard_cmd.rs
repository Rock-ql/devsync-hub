use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::services::dashboard_service::{self, DashboardOverview};

#[tauri::command]
pub async fn get_overview(state: State<'_, AppState>) -> AppResult<DashboardOverview> {
    let db = state.db.lock().await;
    dashboard_service::get_overview(&db.conn)
}
