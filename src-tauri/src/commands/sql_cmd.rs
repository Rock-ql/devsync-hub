use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::models::pending_sql::*;
use crate::models::common::PageResult;
use crate::services::sql_service;

#[tauri::command]
pub async fn list_sql(state: State<'_, AppState>, req: PendingSqlListReq) -> AppResult<PageResult<PendingSqlDetailRsp>> {
    let db = state.db.lock().await;
    sql_service::list_sql(&db.conn, &req)
}

#[tauri::command]
pub async fn get_sql_detail(state: State<'_, AppState>, id: i32) -> AppResult<PendingSqlDetailRsp> {
    let db = state.db.lock().await;
    sql_service::get_sql_detail(&db.conn, id)
}

#[tauri::command]
pub async fn add_sql(state: State<'_, AppState>, req: PendingSqlAddReq) -> AppResult<i32> {
    let db = state.db.lock().await;
    sql_service::add_sql(&db.conn, &req)
}

#[tauri::command]
pub async fn update_sql(state: State<'_, AppState>, req: PendingSqlUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::update_sql(&db.conn, &req)
}

#[tauri::command]
pub async fn delete_sql(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::delete_sql(&db.conn, id)
}

#[tauri::command]
pub async fn execute_sql(state: State<'_, AppState>, req: PendingSqlExecuteReq) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::execute_sql(&db.conn, &req)
}

#[tauri::command]
pub async fn batch_execute_sql(state: State<'_, AppState>, req: PendingSqlBatchExecuteReq) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::batch_execute_sql(&db.conn, &req)
}

#[tauri::command]
pub async fn revoke_execution(state: State<'_, AppState>, req: SqlExecutionRevokeReq) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::revoke_execution(&db.conn, &req)
}

#[tauri::command]
pub async fn batch_delete_sql(state: State<'_, AppState>, req: PendingSqlBatchDeleteReq) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::batch_delete_sql(&db.conn, &req)
}

#[tauri::command]
pub async fn list_sql_env_configs(state: State<'_, AppState>, req: SqlEnvConfigListReq) -> AppResult<Vec<SqlEnvConfig>> {
    let db = state.db.lock().await;
    sql_service::list_sql_env_configs(&db.conn, req.project_id)
}

#[tauri::command]
pub async fn add_sql_env_config(state: State<'_, AppState>, req: SqlEnvConfigAddReq) -> AppResult<i32> {
    let db = state.db.lock().await;
    sql_service::add_sql_env_config(&db.conn, &req)
}

#[tauri::command]
pub async fn update_sql_env_config(state: State<'_, AppState>, req: SqlEnvConfigUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::update_sql_env_config(&db.conn, &req)
}

#[tauri::command]
pub async fn delete_sql_env_config(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let db = state.db.lock().await;
    sql_service::delete_sql_env_config(&db.conn, id)
}
