use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::models::report::*;
use crate::models::common::PageResult;
use crate::services::report_service;
use crate::clients::deepseek_client::DeepSeekClient;

#[tauri::command]
pub async fn list_reports(state: State<'_, AppState>, req: ReportListReq) -> AppResult<PageResult<Report>> {
    let db = state.db.lock().await;
    report_service::list_reports(&db.conn, &req)
}

#[tauri::command]
pub async fn get_report_detail(state: State<'_, AppState>, id: i32) -> AppResult<Report> {
    let db = state.db.lock().await;
    report_service::get_report_detail(&db.conn, id)
}

#[tauri::command]
pub async fn generate_report(state: State<'_, AppState>, req: ReportGenerateReq) -> AppResult<Report> {
    // Phase 1: Read all DB data (sync)
    let ctx = {
        let db = state.db.lock().await;
        report_service::generate_report_prepare(&db.conn, &req)?
    }; // DB lock dropped here

    // Phase 2: Call AI (async, no DB lock held)
    let content = if !ctx.api_key.is_empty() {
        let client = DeepSeekClient::new(&ctx.base_url, &ctx.api_key);
        match client.chat(&ctx.prompt).await {
            Ok(c) => c,
            Err(e) => {
                log::warn!("AI generation failed, using fallback: {}", e);
                report_service::generate_fallback(&ctx.project_commits, &ctx.type_label)
            }
        }
    } else {
        report_service::generate_fallback(&ctx.project_commits, &ctx.type_label)
    };

    // Phase 3: Insert report into DB (sync)
    let db = state.db.lock().await;
    report_service::generate_report_insert(&db.conn, &req, &ctx, &content)
}

#[tauri::command]
pub async fn update_report(state: State<'_, AppState>, req: ReportUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    report_service::update_report(&db.conn, &req)
}

#[tauri::command]
pub async fn delete_report(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let db = state.db.lock().await;
    report_service::delete_report(&db.conn, id)
}

#[tauri::command]
pub async fn get_month_summary(state: State<'_, AppState>, req: ReportMonthSummaryReq) -> AppResult<MonthSummaryRsp> {
    let db = state.db.lock().await;
    report_service::get_month_summary(&db.conn, &req)
}
