use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::models::iteration::*;
use crate::models::common::PageResult;
use crate::services::iteration_service;

#[tauri::command]
pub async fn list_iterations(state: State<'_, AppState>, req: IterationListReq) -> AppResult<PageResult<IterationDetailRsp>> {
    let db = state.db.lock().await;
    iteration_service::list_iterations(&db.conn, &req)
}

#[tauri::command]
pub async fn list_by_project(state: State<'_, AppState>, project_id: i32) -> AppResult<Vec<Iteration>> {
    let db = state.db.lock().await;
    iteration_service::list_by_project(&db.conn, project_id)
}

#[tauri::command]
pub async fn get_iteration_detail(state: State<'_, AppState>, id: i32) -> AppResult<IterationDetailRsp> {
    let db = state.db.lock().await;
    iteration_service::get_iteration_detail(&db.conn, id)
}

#[tauri::command]
pub async fn add_iteration(state: State<'_, AppState>, req: IterationAddReq) -> AppResult<i32> {
    let db = state.db.lock().await;
    iteration_service::add_iteration(&db.conn, &req)
}

#[tauri::command]
pub async fn update_iteration(state: State<'_, AppState>, req: IterationUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    iteration_service::update_iteration(&db.conn, &req)
}

#[tauri::command]
pub async fn delete_iteration(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let mut db = state.db.lock().await;
    iteration_service::delete_iteration(&mut db.conn, id)
}

#[tauri::command]
pub async fn update_iteration_status(state: State<'_, AppState>, id: i32, status: String) -> AppResult<()> {
    let db = state.db.lock().await;
    iteration_service::update_status(&db.conn, id, &status)
}
