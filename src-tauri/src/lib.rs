pub mod db;
pub mod models;
pub mod services;
pub mod commands;
pub mod clients;
pub mod axum_gateway;
pub mod error;
pub mod logging;

use db::Database;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

pub fn run() {
    let db = Database::new().expect("Failed to initialize database");
    db.migrate().expect("Failed to run database migrations");
    logging::init_logger(&db.conn).expect("Failed to initialize logger");

    let state = AppState {
        db: Arc::new(Mutex::new(db)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Project
            commands::project_cmd::list_projects,
            commands::project_cmd::list_all_projects,
            commands::project_cmd::get_project_detail,
            commands::project_cmd::add_project,
            commands::project_cmd::update_project,
            commands::project_cmd::update_project_enabled,
            commands::project_cmd::delete_project,
            commands::project_cmd::sync_commits,
            commands::project_cmd::get_commits,
            commands::project_cmd::list_gitlab_branches,
            // Iteration
            commands::iteration_cmd::list_iterations,
            commands::iteration_cmd::list_by_project,
            commands::iteration_cmd::get_iteration_detail,
            commands::iteration_cmd::add_iteration,
            commands::iteration_cmd::update_iteration,
            commands::iteration_cmd::delete_iteration,
            commands::iteration_cmd::update_iteration_status,
            // Requirement
            commands::requirement_cmd::list_requirements,
            commands::requirement_cmd::list_requirements_page,
            commands::requirement_cmd::list_requirement_commits,
            commands::requirement_cmd::add_requirement,
            commands::requirement_cmd::update_requirement,
            commands::requirement_cmd::update_requirement_status,
            commands::requirement_cmd::delete_requirement,
            commands::requirement_cmd::link_requirement,
            commands::requirement_cmd::get_linked_requirement,
            commands::requirement_cmd::migrate_requirements,
            // SQL
            commands::sql_cmd::list_sql,
            commands::sql_cmd::get_sql_detail,
            commands::sql_cmd::add_sql,
            commands::sql_cmd::update_sql,
            commands::sql_cmd::delete_sql,
            commands::sql_cmd::execute_sql,
            commands::sql_cmd::batch_execute_sql,
            commands::sql_cmd::batch_delete_sql,
            commands::sql_cmd::revoke_execution,
            // Report
            commands::report_cmd::list_reports,
            commands::report_cmd::get_report_detail,
            commands::report_cmd::generate_report,
            commands::report_cmd::update_report,
            commands::report_cmd::delete_report,
            commands::report_cmd::get_month_summary,
            // Dashboard
            commands::dashboard_cmd::get_overview,
            // Setting
            commands::setting_cmd::get_all_settings,
            commands::setting_cmd::update_setting,
            commands::setting_cmd::batch_update_settings,
            commands::setting_cmd::restart_app,
            // ApiKey
            commands::setting_cmd::create_api_key,
            commands::setting_cmd::list_api_keys,
            commands::setting_cmd::delete_api_key,
            // Migration
            commands::migration_cmd::import_data,
            commands::migration_cmd::export_data,
        ])
        .setup(|app| {
            // 设置窗口图标
            if let Some(window) = app.get_webview_window("main") {
                match tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png")) {
                    Ok(icon) => { let _ = window.set_icon(icon); }
                    Err(e) => log::warn!("Failed to load window icon: {}", e),
                }
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = axum_gateway::start_gateway(handle).await {
                    log::error!("Axum gateway failed: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
