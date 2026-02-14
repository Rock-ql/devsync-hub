use devsync_hub_lib::db::{migration, schema};
use devsync_hub_lib::models::report::ReportGenerateReq;
use devsync_hub_lib::services::report_service;
use rusqlite::Connection;
use std::env;
use std::fs;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 4 {
        eprintln!("用法: cargo run --bin report_verify -- <export_json> <start_date> <end_date> [author_email]");
        eprintln!(
            "示例: cargo run --bin report_verify -- ../devsync-export-2026-02-08.json 2026-02-04 2026-02-05 rockcoding@163.com"
        );
        std::process::exit(2);
    }

    let export_path = &args[1];
    let start_date = &args[2];
    let end_date = &args[3];
    let author_email = args.get(4).cloned();

    let json_content = match fs::read_to_string(export_path) {
        Ok(content) => content,
        Err(err) => {
            eprintln!("读取导出文件失败: {} ({})", export_path, err);
            std::process::exit(1);
        }
    };

    let conn = match Connection::open_in_memory() {
        Ok(conn) => conn,
        Err(err) => {
            eprintln!("初始化内存数据库失败: {}", err);
            std::process::exit(1);
        }
    };

    if let Err(err) = conn.execute_batch("PRAGMA foreign_keys=ON;") {
        eprintln!("初始化数据库参数失败: {}", err);
        std::process::exit(1);
    }

    if let Err(err) = schema::run_migrations(&conn) {
        eprintln!("执行数据库迁移失败: {}", err);
        std::process::exit(1);
    }

    if let Err(err) = migration::import_from_json_content(&conn, &json_content) {
        eprintln!("导入 JSON 数据失败: {}", err);
        std::process::exit(1);
    }

    let req = ReportGenerateReq {
        r#type: "daily".to_string(),
        start_date: start_date.to_string(),
        end_date: end_date.to_string(),
        force: false,
        author_email,
        project_ids: None,
    };

    let ctx = match report_service::generate_report_prepare(&conn, &req) {
        Ok(ctx) => ctx,
        Err(err) => {
            eprintln!("生成上下文失败: {}", err);
            std::process::exit(1);
        }
    };

    println!("==== structured_input ====");
    println!("{}", ctx.structured_input);
    println!();
    println!("==== template_reference ====");
    println!("{}", ctx.template);
}

