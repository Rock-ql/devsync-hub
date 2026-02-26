use tauri::State;
use std::collections::HashSet;
use serde::Serialize;
use crate::AppState;
use crate::error::AppResult;
use crate::models::report::*;
use crate::models::common::PageResult;
use crate::services::{project_service, report_service};
use crate::clients::deepseek_client::DeepSeekClient;
use crate::axum_gateway::sse;

#[derive(Debug, Serialize)]
struct ReportGenerateSsePayload {
    mode: String,
    report_type: String,
    start_date: String,
    end_date: String,
    stage: String,
    message: String,
    percent: i32,
    status: String,
}

fn report_mode(req: &ReportGenerateReq) -> &'static str {
    if req.r#type.eq_ignore_ascii_case("daily") && req.append_existing {
        "update"
    } else {
        "generate"
    }
}

fn emit_report_generate(req: &ReportGenerateReq, stage: &str, message: impl Into<String>, percent: i32, status: &str) {
    let payload = ReportGenerateSsePayload {
        mode: report_mode(req).to_string(),
        report_type: req.r#type.clone(),
        start_date: req.start_date.clone(),
        end_date: req.end_date.clone(),
        stage: stage.to_string(),
        message: message.into(),
        percent: percent.clamp(0, 100),
        status: status.to_string(),
    };
    let data = serde_json::to_string(&payload).unwrap_or_default();
    sse::publish("report_generate", &data);
}

async fn sync_projects_before_daily_report(state: &AppState, req: &ReportGenerateReq) -> AppResult<()> {
    let selected_ids = req
        .project_ids
        .as_ref()
        .filter(|ids| !ids.is_empty())
        .map(|ids| ids.iter().copied().collect::<HashSet<i32>>());

    let projects = {
        let db = state.db.lock().await;
        project_service::list_all_projects(&db.conn)?
    };

    let mut synced = 0;
    let mut failed = 0;
    let mut skipped = 0;
    let mut total_added = 0;

    let target_projects: Vec<_> = projects
        .into_iter()
        .filter(|project| {
            selected_ids
                .as_ref()
                .map(|ids| ids.contains(&project.id))
                .unwrap_or(true)
        })
        .collect();
    let total = target_projects.len();

    if total == 0 {
        emit_report_generate(req, "sync", "未找到需要同步的项目", 60, "running");
        return Ok(());
    }

    for (index, project) in target_projects.into_iter().enumerate() {
        let progress = 10 + ((index as i32) * 45 / total as i32);
        emit_report_generate(
            req,
            "sync",
            format!("同步项目提交中：{}/{} {}", index + 1, total, project.name),
            progress,
            "running",
        );

        if project.gitlab_url.trim().is_empty() {
            skipped += 1;
            log::info!(
                "[报告生成] 跳过项目同步（未配置 GitLab）: id={}, name={}",
                project.id,
                project.name
            );
            continue;
        }

        match super::project_cmd::sync_project_commits_internal(state, project.id, false).await {
            Ok(added) => {
                synced += 1;
                total_added += added;
            }
            Err(err) => {
                failed += 1;
                log::warn!(
                    "[报告生成] 项目同步失败，继续生成日报: id={}, name={}, err={}",
                    project.id,
                    project.name,
                    err
                );
            }
        }

        let progress = 10 + (((index + 1) as i32) * 45 / total as i32);
        emit_report_generate(
            req,
            "sync",
            format!(
                "同步进度：{}/{}（新增 {}，失败 {}，跳过 {}）",
                index + 1,
                total,
                total_added,
                failed,
                skipped
            ),
            progress,
            "running",
        );
    }

    log::info!(
        "[报告生成] 日报生成前项目同步完成: synced={}, failed={}, skipped={}, total_added={}",
        synced,
        failed,
        skipped,
        total_added
    );
    emit_report_generate(
        req,
        "sync_done",
        format!("提交同步完成：成功 {}，失败 {}，跳过 {}，新增 {}", synced, failed, skipped, total_added),
        60,
        "running",
    );

    Ok(())
}

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
    emit_report_generate(
        &req,
        "start",
        if report_mode(&req) == "update" { "开始更新日报..." } else { "开始生成报告..." },
        0,
        "running",
    );

    // 非强制生成：如果报告已存在则直接返回，避免重复生成
    if !req.force && !req.append_existing {
        let db = state.db.lock().await;
        if let Some(existing) = report_service::find_existing_report(&db.conn, &req)? {
            log::info!(
                "[报告生成] 报告已存在，直接返回: type={}, {}~{}",
                req.r#type,
                req.start_date,
                req.end_date
            );
            emit_report_generate(&req, "done", "报告已存在，直接返回", 100, "done");
            return Ok(existing);
        }
    }

    if req.r#type.eq_ignore_ascii_case("daily") {
        if let Err(err) = sync_projects_before_daily_report(state.inner(), &req).await {
            emit_report_generate(&req, "error", format!("同步项目提交失败：{}", err), 100, "error");
            return Err(err);
        }
    }

    // Phase 1: Read all DB data (sync)
    emit_report_generate(&req, "prepare", "准备报告上下文...", 70, "running");
    let ctx = {
        let db = state.db.lock().await;
        match report_service::generate_report_prepare(&db.conn, &req) {
            Ok(ctx) => ctx,
            Err(err) => {
                emit_report_generate(&req, "error", format!("准备报告失败：{}", err), 100, "error");
                return Err(err);
            }
        }
    }; // DB lock dropped here

    // Phase 2: Build content (async, no DB lock held)
    let content = if req.append_existing && req.r#type.eq_ignore_ascii_case("daily") {
        emit_report_generate(&req, "append", "正在基于现有日报补充新增提交...", 85, "running");
        report_service::generate_fallback(
            &ctx.report_type,
            &ctx.structured_input,
            &ctx.project_commits,
            &ctx.type_label,
        )
    } else if !ctx.api_key.is_empty() && !ctx.structured_input.is_empty() {
        emit_report_generate(&req, "ai", "正在调用 AI 生成报告...", 85, "running");
        let client = DeepSeekClient::new(&ctx.base_url, &ctx.api_key);
        let result = if ctx.report_type == "weekly" {
            client.generate_weekly_report(&ctx.structured_input, &ctx.template).await
        } else {
            client.generate_daily_report(&ctx.structured_input, &ctx.template).await
        };
        match result {
            Ok(c) => c,
            Err(e) => {
                log::warn!("[报告生成] AI生成{}失败，使用fallback: {}", ctx.type_label, e);
                report_service::generate_fallback(
                    &ctx.report_type,
                    &ctx.structured_input,
                    &ctx.project_commits,
                    &ctx.type_label,
                )
            }
        }
    } else {
        if ctx.api_key.is_empty() {
            log::warn!("[报告生成] 未配置DeepSeek API Key，使用fallback");
        }
        report_service::generate_fallback(
            &ctx.report_type,
            &ctx.structured_input,
            &ctx.project_commits,
            &ctx.type_label,
        )
    };

    // Phase 3: Upsert report into DB (sync)
    emit_report_generate(&req, "save", "正在保存报告...", 95, "running");
    let db = state.db.lock().await;
    match report_service::generate_report_upsert(&db.conn, &req, &ctx, &content) {
        Ok(report) => {
            emit_report_generate(&req, "done", "报告生成完成", 100, "done");
            Ok(report)
        }
        Err(err) => {
            emit_report_generate(&req, "error", format!("保存报告失败：{}", err), 100, "error");
            Err(err)
        }
    }
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
