use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::models::requirement::*;
use crate::services::requirement_service;

#[tauri::command]
pub async fn list_requirements(state: State<'_, AppState>, req: RequirementListReq) -> AppResult<Vec<RequirementDetailRsp>> {
    let db = state.db.lock().await;
    requirement_service::list_requirements(&db.conn, &req)
}

#[tauri::command]
pub async fn add_requirement(state: State<'_, AppState>, req: RequirementAddReq) -> AppResult<i32> {
    let db = state.db.lock().await;
    requirement_service::add_requirement(&db.conn, &req)
}

#[tauri::command]
pub async fn update_requirement(state: State<'_, AppState>, req: RequirementUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    requirement_service::update_requirement(&db.conn, &req)
}

#[tauri::command]
pub async fn update_requirement_status(state: State<'_, AppState>, req: RequirementStatusUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    requirement_service::update_status(&db.conn, &req)
}

#[tauri::command]
pub async fn delete_requirement(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let db = state.db.lock().await;
    requirement_service::delete_requirement(&db.conn, id)
}

#[tauri::command]
pub async fn link_requirement(state: State<'_, AppState>, req: RequirementLinkReq) -> AppResult<()> {
    let db = state.db.lock().await;
    requirement_service::link_requirement(&db.conn, &req)
}

#[tauri::command]
pub async fn get_linked_requirement(state: State<'_, AppState>, link_type: String, link_id: i32) -> AppResult<Option<Requirement>> {
    let db = state.db.lock().await;
    requirement_service::get_linked_requirement(&db.conn, &link_type, link_id)
}
