use tauri::{AppHandle, State};
use crate::AppState;
use crate::error::AppResult;
use crate::models::system_setting::*;
use crate::models::api_key::*;
use crate::services::setting_service;

#[tauri::command]
pub async fn get_all_settings(state: State<'_, AppState>) -> AppResult<Vec<SystemSetting>> {
    let db = state.db.lock().await;
    setting_service::get_all_settings(&db.conn)
}

#[tauri::command]
pub async fn update_setting(state: State<'_, AppState>, req: SettingUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    setting_service::update_setting(&db.conn, &req)
}

#[tauri::command]
pub async fn batch_update_settings(state: State<'_, AppState>, req: BatchSettingUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    setting_service::batch_update_settings(&db.conn, &req.settings)
}

#[tauri::command]
pub async fn create_api_key(state: State<'_, AppState>, req: ApiKeyCreateReq) -> AppResult<ApiKeyCreateRsp> {
    let db = state.db.lock().await;
    setting_service::create_api_key(&db.conn, &req)
}

#[tauri::command]
pub async fn list_api_keys(state: State<'_, AppState>) -> AppResult<Vec<ApiKey>> {
    let db = state.db.lock().await;
    setting_service::list_api_keys(&db.conn)
}

#[tauri::command]
pub async fn delete_api_key(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let db = state.db.lock().await;
    setting_service::delete_api_key(&db.conn, id)
}

#[tauri::command]
pub fn restart_app(handle: AppHandle) {
    handle.restart();
}
