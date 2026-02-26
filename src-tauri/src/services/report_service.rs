use rusqlite::{params, Connection, OptionalExtension};
use crate::error::{AppError, AppResult};
use crate::models::report::*;
use crate::models::common::PageResult;
use crate::models::requirement::Requirement;
use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone};
use std::collections::{HashMap, HashSet};

const NEAREST_ANCHOR_MAX_MINUTES: i64 = 30;

#[derive(Debug, Clone)]
struct CommitInfo {
    id: i32,
    project_id: i32,
    project_name: String,
    message: String,
    branch: String,
    committed_at: String,
}

#[derive(Debug, Clone)]
struct CodedRequirement {
    requirement: Requirement,
    code: String,
}

pub fn list_reports(conn: &Connection, req: &ReportListReq) -> AppResult<PageResult<Report>> {
    let page = req.page.unwrap_or(1);
    let size = req.size.unwrap_or(20);
    let offset = (page - 1) * size;

    let mut wc = "WHERE state = 1 AND deleted_at IS NULL".to_string();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(t) = &req.r#type {
        if !t.is_empty() {
            wc.push_str(" AND type = ?");
            pv.push(Box::new(t.clone()));
        }
    }
    if let Some(kw) = &req.keyword {
        if !kw.is_empty() {
            wc.push_str(" AND (title LIKE ? OR content LIKE ?)");
            pv.push(Box::new(format!("%{}%", kw)));
            pv.push(Box::new(format!("%{}%", kw)));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM report {}", wc);
    let crefs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    let total: i64 = conn.query_row(&count_sql, crefs.as_slice(), |r| r.get(0))?;

    let qsql = format!(
        "SELECT id, type, title, content, start_date, end_date, commit_summary, state, created_at, updated_at FROM report {} ORDER BY id DESC LIMIT ? OFFSET ?",
        wc
    );
    let mut qp: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(t) = &req.r#type { if !t.is_empty() { qp.push(Box::new(t.clone())); } }
    if let Some(kw) = &req.keyword { if !kw.is_empty() { qp.push(Box::new(format!("%{}%", kw))); qp.push(Box::new(format!("%{}%", kw))); } }
    qp.push(Box::new(size));
    qp.push(Box::new(offset));
    let qrefs: Vec<&dyn rusqlite::types::ToSql> = qp.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&qsql)?;
    let rows = stmt.query_map(qrefs.as_slice(), |row| {
        Ok(Report {
            id: row.get(0)?, r#type: row.get(1)?, title: row.get(2)?, content: row.get(3)?,
            start_date: row.get(4)?, end_date: row.get(5)?, commit_summary: row.get(6)?,
            state: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
        })
    })?;
    let records: Vec<Report> = rows.filter_map(|r| r.ok()).collect();
    Ok(PageResult { records, total, page, size })
}

pub fn get_report_detail(conn: &Connection, id: i32) -> AppResult<Report> {
    conn.query_row(
        "SELECT id, type, title, content, start_date, end_date, commit_summary, state, created_at, updated_at FROM report WHERE id = ? AND state = 1",
        params![id],
        |row| Ok(Report {
            id: row.get(0)?, r#type: row.get(1)?, title: row.get(2)?, content: row.get(3)?,
            start_date: row.get(4)?, end_date: row.get(5)?, commit_summary: row.get(6)?,
            state: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
        }),
    ).map_err(|_| AppError::NotFound("Report not found".into()))
}

pub struct GenerateReportContext {
    pub report_type: String,
    pub commit_summary: String,
    pub structured_input: String,
    pub template: String,
    pub type_label: String,
    pub project_commits: HashMap<String, Vec<String>>,
    pub base_url: String,
    pub api_key: String,
}

pub fn generate_report_prepare(conn: &Connection, req: &ReportGenerateReq) -> AppResult<GenerateReportContext> {
    let type_label = if req.r#type == "daily" { "日报" } else { "周报" };

    let (structured_input, project_commits) = if req.r#type == "weekly" {
        // 周报：优先从当周日报聚合（即使没有 Git 提交也能生成）
        let (weekly_summary, daily_project_work) =
            build_weekly_summary_from_daily_reports_with_projects(conn, &req.start_date, &req.end_date);
        if !weekly_summary.trim().is_empty() {
            log::info!("[报告生成] 周报使用当周日报聚合，日期: {} ~ {}", req.start_date, req.end_date);
            (weekly_summary, daily_project_work)
        } else {
            log::info!("[报告生成] 周报无可用日报，回退到Git提交记录");
            match query_commits(conn, req) {
                Ok(commits) => {
                    let pc = build_project_commits(&commits);
                    (format_commits_text(&pc), pc)
                }
                Err(_) => (String::new(), HashMap::new()),
            }
        }
    } else {
        // 日报：基于 Git 提交记录生成，无提交时直接插入空报告
        match query_commits(conn, req) {
            Ok(commits) => {
                let project_commits = build_project_commits(&commits);
                let structured_input = match build_daily_summary_by_requirement(conn, &commits, &req.start_date) {
                    Ok(text) => text,
                    Err(err) => {
                        log::warn!("[报告生成] 构建日报结构化输入失败，回退到Git提交: {}", err);
                        format_commits_text(&project_commits)
                    }
                };
                (structured_input, project_commits)
            }
            Err(_) => (String::new(), HashMap::new()),
        }
    };

    let commit_summary = serde_json::to_string(&project_commits).unwrap_or_default();

    // 获取模板
    let template: String = conn.query_row(
        "SELECT content FROM report_template WHERE type = ? AND is_default = 1 AND state = 1",
        params![req.r#type], |row| row.get(0),
    ).unwrap_or_else(|_| String::new());

    let template = if req.r#type == "daily" {
        build_daily_template_reference(&template)
    } else {
        template
    };

    // 获取 API 配置
    let base_url: String = conn.query_row(
        "SELECT setting_value FROM system_setting WHERE setting_key = 'deepseek.base.url' AND state = 1",
        [], |r| r.get(0),
    ).unwrap_or_else(|_| "https://api.deepseek.com".to_string());

    let api_key: String = conn.query_row(
        "SELECT setting_value FROM system_setting WHERE setting_key = 'deepseek.api.key' AND state = 1",
        [], |r| r.get(0),
    ).unwrap_or_default();

    Ok(GenerateReportContext {
        report_type: req.r#type.clone(),
        commit_summary,
        structured_input,
        template,
        type_label: type_label.to_string(),
        project_commits,
        base_url,
        api_key,
    })
}

fn query_commits(conn: &Connection, req: &ReportGenerateReq) -> AppResult<Vec<CommitInfo>> {
    let mut sql = "SELECT gc.id, gc.commit_id, gc.project_id, p.name, gc.message, gc.branch, gc.committed_at FROM git_commit gc \
        INNER JOIN project p ON gc.project_id = p.id \
        WHERE gc.state = 1 AND gc.deleted_at IS NULL \
          AND p.state = 1 AND p.deleted_at IS NULL \
          AND SUBSTR(gc.committed_at, 1, 10) >= ? AND SUBSTR(gc.committed_at, 1, 10) <= ?"
        .to_string();

    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(req.start_date.clone()),
        Box::new(req.end_date.clone()),
    ];

    if let Some(email) = &req.author_email {
        let normalized = email.trim();
        if !normalized.is_empty() {
            sql.push_str(" AND gc.author_email = ?");
            pv.push(Box::new(normalized.to_string()));
        }
    }

    if let Some(pids) = &req.project_ids {
        if !pids.is_empty() {
            let placeholders: Vec<String> = pids.iter().map(|_| "?".to_string()).collect();
            sql.push_str(&format!(" AND gc.project_id IN ({})", placeholders.join(",")));
            for pid in pids {
                pv.push(Box::new(*pid));
            }
        }
    }

    sql.push_str(" ORDER BY gc.committed_at ASC, gc.id ASC");

    let refs: Vec<&dyn rusqlite::types::ToSql> = pv
        .iter()
        .map(|p| p.as_ref() as &dyn rusqlite::types::ToSql)
        .collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(refs.as_slice(), |row| {
        Ok(CommitInfo {
            id: row.get(0)?,
            project_id: row.get(2)?,
            project_name: row.get(3)?,
            message: row.get(4)?,
            branch: row.get(5)?,
            committed_at: row.get(6)?,
        })
    })?;

    let commits: Vec<CommitInfo> = rows.filter_map(|r| r.ok()).collect();
    if commits.is_empty() {
        return Err(AppError::BadRequest("指定日期范围内没有找到提交记录".into()));
    }
    Ok(commits)
}

fn build_project_commits(commits: &[CommitInfo]) -> HashMap<String, Vec<String>> {
    let mut result: HashMap<String, Vec<String>> = HashMap::new();
    for commit in commits {
        if is_merge_commit(&commit.message) {
            continue;
        }
        let message = normalize_commit_message(&commit.message);
        if message.is_empty() {
            continue;
        }
        result
            .entry(commit.project_name.clone())
            .or_default()
            .push(message);
    }
    result
}

fn build_daily_summary_by_requirement(conn: &Connection, commits: &[CommitInfo], date: &str) -> AppResult<String> {
    let display_commits: Vec<CommitInfo> = commits
        .iter()
        .filter(|commit| !is_merge_commit(&commit.message))
        .cloned()
        .collect();

    log::info!("[日报生成] 总提交数: {}, 过滤merge后: {}", commits.len(), display_commits.len());

    if display_commits.is_empty() {
        let mut output = String::new();
        append_status_changes(&mut output, conn, date, &HashSet::new());
        if output.trim().is_empty() {
            return Ok("暂无提交记录".to_string());
        }
        return Ok(output.trim().to_string());
    }

    let requirements = load_active_requirements(conn)?;
    log::info!("[日报生成] 活跃需求数: {}", requirements.len());
    if requirements.is_empty() {
        log::warn!("[日报生成] 无活跃需求，回退到按项目分组");
        let mut output = render_daily_other_work_only(&display_commits);
        append_status_changes(&mut output, conn, date, &HashSet::new());
        return Ok(output.trim().to_string());
    }

    let coded_requirements: Vec<CodedRequirement> = requirements
        .into_iter()
        .filter_map(|requirement| {
            let code = get_requirement_code(&requirement);
            if code.is_empty() {
                None
            } else {
                Some(CodedRequirement { requirement, code })
            }
        })
        .collect();

    log::info!("[日报生成] 有编号的需求数: {}", coded_requirements.len());
    for cr in &coded_requirements {
        log::info!("[日报生成] 需求: id={}, code={}, branch={}", cr.requirement.id, cr.code, cr.requirement.branch);
    }
    if coded_requirements.is_empty() {
        log::warn!("[日报生成] 所有需求均无编号，回退到按项目分组");
        let mut output = render_daily_other_work_only(&display_commits);
        append_status_changes(&mut output, conn, date, &HashSet::new());
        return Ok(output.trim().to_string());
    }

    let requirement_ids: Vec<i32> = coded_requirements.iter().map(|item| item.requirement.id).collect();
    let requirement_project_ids = load_requirement_project_ids(conn, &requirement_ids)?;

    // 优先使用 work_item_link 中已有的 commit-requirement 关联
    let commit_ids: Vec<i32> = display_commits.iter().map(|c| c.id).collect();
    let existing_links = load_commit_requirement_links(conn, &commit_ids);
    log::info!("[日报生成] work_item_link 已有关联数: {}", existing_links.len());
    for commit in &display_commits {
        let msg_preview: String = commit.message.chars().take(40).collect();
        log::info!("[日报生成] 提交: id={}, branch={}, msg={}", commit.id, commit.branch, msg_preview);
    }
    let valid_requirement_ids: HashSet<i32> = coded_requirements.iter().map(|cr| cr.requirement.id).collect();

    let mut requirement_commits: HashMap<i32, Vec<CommitInfo>> = HashMap::new();
    let mut other_commits: Vec<CommitInfo> = Vec::new();

    // 策略0: 扫描 merge commit，建立需求锚点（merge commit 消息含 feature 分支名）
    // 用独立 map 存锚点，不污染 requirement_commits（merge commit 不输出到报告）
    let mut merge_anchors: HashMap<i32, Vec<CommitInfo>> = HashMap::new();
    for commit in commits {
        if !is_merge_commit(&commit.message) {
            continue;
        }
        if let Some(req_id) = match_requirement(commit, &coded_requirements, &requirement_project_ids) {
            merge_anchors
                .entry(req_id)
                .or_default()
                .push(commit.clone());
        }
    }
    log::info!("[日报生成] merge commit 锚点匹配后，需求命中数: {}", merge_anchors.len());

    for commit in &display_commits {
        // 策略1: 先查 work_item_link 已有关联
        if let Some(&req_id) = existing_links.get(&commit.id) {
            if valid_requirement_ids.contains(&req_id) {
                requirement_commits
                    .entry(req_id)
                    .or_default()
                    .push(commit.clone());
                continue;
            }
        }

        // 策略2: 回退到原有匹配逻辑（分支/消息/项目）
        if let Some(requirement_id) = match_requirement(commit, &coded_requirements, &requirement_project_ids) {
            requirement_commits
                .entry(requirement_id)
                .or_default()
                .push(commit.clone());
        } else {
            other_commits.push(commit.clone());
        }
    }

    // 将 merge_anchors 合并进 requirement_commits 用于时间邻近分配
    for (req_id, anchors) in &merge_anchors {
        requirement_commits.entry(*req_id).or_default().extend(anchors.clone());
    }
    other_commits = assign_unmatched_commits_by_nearest_anchor(other_commits, &mut requirement_commits);
    // 移除纯 merge commit 锚点（不输出到报告）
    for (req_id, anchors) in &merge_anchors {
        if let Some(v) = requirement_commits.get_mut(req_id) {
            v.retain(|c| !anchors.iter().any(|a| a.id == c.id));
            if v.is_empty() {
                requirement_commits.remove(req_id);
            }
        }
    }

    log::info!("[日报生成] 匹配到需求的提交数: {}, 未匹配: {}",
        requirement_commits.values().map(|v| v.len()).sum::<usize>(),
        other_commits.len()
    );

    if requirement_commits.is_empty() {
        log::warn!("[日报生成] 无提交匹配到需求，回退到按项目分组");
        let mut output = render_daily_other_work_only(&display_commits);
        append_status_changes(&mut output, conn, date, &HashSet::new());
        return Ok(output.trim().to_string());
    }

    let mut output = String::from("## 需求工作:\n");
    let mut has_requirement_content = false;

    for coded in &coded_requirements {
        let grouped_commits = requirement_commits.get(&coded.requirement.id);
        if grouped_commits.is_none() || grouped_commits.is_some_and(|items| items.is_empty()) {
            continue;
        }

        let grouped_commits = grouped_commits.unwrap_or(&Vec::new()).clone();
        if grouped_commits.is_empty() {
            continue;
        }

        has_requirement_content = true;
        let project_display = format_requirement_projects(&grouped_commits);
        let status_text = format_requirement_status(&coded.requirement.status);
        let environment = coded.requirement.environment.trim();
        let bracket_text = if environment.is_empty() {
            format!("状态: {}", status_text)
        } else {
            format!("状态: {}, 环境: {}", status_text, environment)
        };

        output.push_str(&format!(
            "### {}【{}】{} ({})\n",
            coded.code, project_display, coded.requirement.name, bracket_text
        ));
        append_commit_lines(&mut output, &grouped_commits);
        output.push('\n');
    }

    if !has_requirement_content {
        let mut output = render_daily_other_work_only(&display_commits);
        append_status_changes(&mut output, conn, date, &HashSet::new());
        return Ok(output.trim().to_string());
    }

    if !other_commits.is_empty() {
        output.push_str("## 其他工作:\n");
        append_other_work_by_project(&mut output, &other_commits);
    }

    // 注入当日正向状态变更（排除已有提交覆盖的需求）
    let shown_requirement_ids: HashSet<i32> = requirement_commits.keys().cloned().collect();
    append_status_changes(&mut output, conn, date, &shown_requirement_ids);

    Ok(output.trim().to_string())
}

/// 从 work_item_link 表加载 commit -> requirement 的已有关联
/// work_item_link 中 work_item_id = requirement_id, link_type = 'commit', link_id = git_commit.id
fn load_commit_requirement_links(conn: &Connection, commit_ids: &[i32]) -> HashMap<i32, i32> {
    if commit_ids.is_empty() {
        return HashMap::new();
    }

    let placeholders: Vec<String> = commit_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT link_id, work_item_id FROM work_item_link \
         WHERE link_type = 'commit' AND state = 1 AND deleted_at IS NULL \
         AND link_id IN ({})",
        placeholders.join(",")
    );

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for id in commit_ids {
        params_vec.push(Box::new(*id));
    }
    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec
        .iter()
        .map(|value| value.as_ref() as &dyn rusqlite::types::ToSql)
        .collect();

    let mut stmt = match conn.prepare(&sql) {
        Ok(stmt) => stmt,
        Err(err) => {
            log::warn!("[报告生成] 查询 work_item_link 失败: {}", err);
            return HashMap::new();
        }
    };

    let rows = match stmt.query_map(refs.as_slice(), |row| {
        Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?))
    }) {
        Ok(rows) => rows,
        Err(err) => {
            log::warn!("[报告生成] 读取 work_item_link 行失败: {}", err);
            return HashMap::new();
        }
    };

    let mut result: HashMap<i32, i32> = HashMap::new();
    for item in rows.filter_map(|r| r.ok()) {
        // item.0 = link_id (git_commit.id), item.1 = work_item_id (requirement_id)
        result.insert(item.0, item.1);
    }
    result
}

fn load_active_requirements(conn: &Connection) -> AppResult<Vec<Requirement>> {
    let mut stmt = conn.prepare(
        "SELECT id, iteration_id, name, requirement_code, environment, link, status, branch, state, created_at, updated_at \
         FROM requirement \
         WHERE state = 1 AND deleted_at IS NULL \
         ORDER BY updated_at DESC, id DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Requirement {
            id: row.get(0)?,
            iteration_id: row.get(1)?,
            name: row.get(2)?,
            requirement_code: row.get(3)?,
            environment: row.get(4)?,
            link: row.get(5)?,
            status: row.get(6)?,
            branch: row.get(7)?,
            state: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn load_requirement_project_ids(
    conn: &Connection,
    requirement_ids: &[i32],
) -> AppResult<HashMap<i32, HashSet<i32>>> {
    if requirement_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<String> = requirement_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT requirement_id, project_id FROM requirement_project WHERE state = 1 AND deleted_at IS NULL AND requirement_id IN ({})",
        placeholders.join(",")
    );

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for requirement_id in requirement_ids {
        params_vec.push(Box::new(*requirement_id));
    }
    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec
        .iter()
        .map(|value| value.as_ref() as &dyn rusqlite::types::ToSql)
        .collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(refs.as_slice(), |row| {
        Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?))
    })?;

    let mut result: HashMap<i32, HashSet<i32>> = HashMap::new();
    for item in rows.filter_map(|r| r.ok()) {
        result.entry(item.0).or_default().insert(item.1);
    }
    Ok(result)
}

fn match_requirement(
    commit: &CommitInfo,
    requirements: &[CodedRequirement],
    requirement_project_ids: &HashMap<i32, HashSet<i32>>,
) -> Option<i32> {
    let branch_candidates = parse_branch_candidates(&commit.branch);

    // 策略1: 提交所在分支包含需求编号（如分支名 feature/ABC-123）
    for requirement in requirements {
        let requirement_code = requirement.code.to_lowercase();
        if !requirement_code.is_empty()
            && branch_candidates
                .iter()
                .any(|candidate| candidate.contains(&requirement_code))
        {
            return Some(requirement.requirement.id);
        }
    }

    // 策略2: 提交消息中包含需求编号
    let message_code = extract_requirement_code_from_text(&commit.message);
    if !message_code.is_empty() {
        for requirement in requirements {
            if message_code == requirement.code {
                return Some(requirement.requirement.id);
            }
        }
    }

    // 策略3: 提交消息中包含需求的分支名（如 merge commit 消息 "Merge branch 'feature/ABC-123'"）
    let message_lower = commit.message.trim().to_lowercase();
    for requirement in requirements {
        let req_branch = requirement.requirement.branch.trim().to_lowercase();
        if !req_branch.is_empty() && message_lower.contains(&req_branch) {
            return Some(requirement.requirement.id);
        }
    }

    // 策略4: 提交所属项目只关联了一个需求
    let mut project_matched_ids: Vec<i32> = Vec::new();
    for requirement in requirements {
        if let Some(project_ids) = requirement_project_ids.get(&requirement.requirement.id) {
            if project_ids.contains(&commit.project_id) {
                project_matched_ids.push(requirement.requirement.id);
            }
        }
    }

    log::debug!("[日报匹配] commit.id={} project_id={} project_matched_ids={:?}",
        commit.id, commit.project_id, project_matched_ids);

    // 策略4仅对需求相关分支生效，避免 bug/chore 等分支被按项目误归类
    if !is_requirement_related_branch(&commit.branch) {
        return None;
    }

    if project_matched_ids.len() == 1 {
        project_matched_ids.first().copied()
    } else {
        None
    }
}

#[derive(Debug, Clone)]
struct RequirementAnchor {
    requirement_id: i32,
    committed_at: DateTime<FixedOffset>,
}

fn assign_unmatched_commits_by_nearest_anchor(
    unmatched_commits: Vec<CommitInfo>,
    requirement_commits: &mut HashMap<i32, Vec<CommitInfo>>,
) -> Vec<CommitInfo> {
    if unmatched_commits.is_empty() || requirement_commits.is_empty() {
        return unmatched_commits;
    }

    let mut anchors_by_project: HashMap<i32, Vec<RequirementAnchor>> = HashMap::new();
    for (requirement_id, commits) in requirement_commits.iter() {
        for commit in commits {
            if let Some(committed_at) = parse_commit_time(&commit.committed_at) {
                anchors_by_project
                    .entry(commit.project_id)
                    .or_default()
                    .push(RequirementAnchor {
                        requirement_id: *requirement_id,
                        committed_at,
                    });
            }
        }
    }

    if anchors_by_project.is_empty() {
        return unmatched_commits;
    }

    let mut still_unmatched: Vec<CommitInfo> = Vec::new();

    for commit in unmatched_commits {
        // 仅对需求相关分支尝试“邻近锚点”归属，避免误把杂项提交归入需求
        if !is_requirement_related_branch(&commit.branch) {
            still_unmatched.push(commit);
            continue;
        }

        let Some(commit_time) = parse_commit_time(&commit.committed_at) else {
            still_unmatched.push(commit);
            continue;
        };

        let Some(anchors) = anchors_by_project.get(&commit.project_id) else {
            still_unmatched.push(commit);
            continue;
        };

        let mut nearest_requirement_id: Option<i32> = None;
        let mut nearest_minutes = i64::MAX;

        for anchor in anchors {
            let minutes = (commit_time - anchor.committed_at).num_minutes().abs();
            if anchor.committed_at.date_naive() == commit_time.date_naive()
                && minutes <= NEAREST_ANCHOR_MAX_MINUTES
                && minutes < nearest_minutes
            {
                nearest_minutes = minutes;
                nearest_requirement_id = Some(anchor.requirement_id);
            }
        }

        if let Some(requirement_id) = nearest_requirement_id {
            requirement_commits
                .entry(requirement_id)
                .or_default()
                .push(commit.clone());
        } else {
            still_unmatched.push(commit);
        }
    }

    still_unmatched
}

fn get_requirement_code(requirement: &Requirement) -> String {
    let configured = requirement.requirement_code.trim().to_uppercase();
    if !configured.is_empty() {
        return configured;
    }
    let from_name = extract_requirement_code_from_text(&requirement.name);
    if !from_name.is_empty() {
        return from_name;
    }
    // 尝试从需求关联的分支名中提取编号（如 feature/ABC-123）
    extract_requirement_code_from_text(&requirement.branch)
}

fn extract_requirement_code_from_text(text: &str) -> String {
    let chars: Vec<char> = text.trim().to_uppercase().chars().collect();
    if chars.is_empty() {
        return String::new();
    }

    let mut index = 0;
    while index < chars.len() {
        if !chars[index].is_ascii_alphabetic() {
            index += 1;
            continue;
        }

        let start = index;
        while index < chars.len() && chars[index].is_ascii_alphabetic() {
            index += 1;
        }

        if index >= chars.len() || chars[index] != '-' {
            continue;
        }

        let hyphen_idx = index;
        index += 1;
        let digits_start = index;
        while index < chars.len() && chars[index].is_ascii_digit() {
            index += 1;
        }

        if index > digits_start {
            return chars[start..index].iter().collect();
        }

        index = hyphen_idx + 1;
    }

    String::new()
}

fn parse_branch_candidates(branch_text: &str) -> HashSet<String> {
    let mut result = HashSet::new();
    let trimmed = branch_text.trim();
    if trimmed.is_empty() {
        return result;
    }

    for item in trimmed.split(',') {
        let normalized = item.trim().to_lowercase();
        if !normalized.is_empty() {
            result.insert(normalized);
        }
    }

    if result.is_empty() {
        result.insert(trimmed.to_lowercase());
    }

    result
}

fn is_requirement_related_branch(branch_text: &str) -> bool {
    let candidates = parse_branch_candidates(branch_text);
    if candidates.is_empty() {
        return false;
    }

    for candidate in candidates {
        if extract_requirement_code_from_text(&candidate).is_empty() {
            if candidate.starts_with("feature/") || candidate.starts_with("feat/") {
                return true;
            }
            continue;
        }
        return true;
    }

    false
}

fn parse_commit_time(time_text: &str) -> Option<DateTime<FixedOffset>> {
    let value = time_text.trim();
    if value.is_empty() {
        return None;
    }

    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return Some(parsed);
    }

    let offset = FixedOffset::east_opt(8 * 3600)?;

    for format in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%.f",
    ] {
        if let Ok(naive) = NaiveDateTime::parse_from_str(value, format) {
            if let Some(parsed) = offset.from_local_datetime(&naive).single() {
                return Some(parsed);
            }
        }
    }

    None
}

fn status_order(status: &str) -> i32 {
    match status {
        "presented" => 0,
        "pending_dev" => 1,
        "developing" => 2,
        "integrating" => 3,
        "pending_test" => 4,
        "testing" => 5,
        "pending_acceptance" => 6,
        "pending_release" => 7,
        "released" => 8,
        _ => -1,
    }
}

fn is_forward_transition(from: &str, to: &str) -> bool {
    status_order(to) > status_order(from)
}

fn status_change_action_text(to: &str) -> String {
    match to {
        "released" => "完成上线".to_string(),
        "pending_release" => "完成验收，等待上线".to_string(),
        "pending_acceptance" => "完成测试，待验收".to_string(),
        "testing" => "提测".to_string(),
        "pending_test" => "完成联调，提交测试".to_string(),
        "integrating" => "完成开发，进入联调".to_string(),
        "developing" => "开始开发".to_string(),
        _ => format!("状态更新为 {}", format_requirement_status(to)),
    }
}

struct StatusChangeEntry {
    requirement_name: String,
    project_names: String,
    to_status: String,
}

fn load_forward_status_changes(conn: &Connection, date: &str, exclude_ids: &HashSet<i32>) -> Vec<StatusChangeEntry> {
    // 查询当日所有状态变更，按 requirement_id 分组取最终状态（id 最大的记录）
    let sql = r#"
        SELECT rsl.requirement_id, rsl.from_status, rsl.to_status,
               r.name AS req_name,
               COALESCE(GROUP_CONCAT(DISTINCT p.name), '') AS project_names
        FROM requirement_status_log rsl
        INNER JOIN requirement r ON rsl.requirement_id = r.id AND r.state = 1 AND r.deleted_at IS NULL
        LEFT JOIN requirement_project rp ON rp.requirement_id = r.id AND rp.state = 1 AND rp.deleted_at IS NULL
        LEFT JOIN project p ON p.id = rp.project_id AND p.state = 1 AND p.deleted_at IS NULL
        WHERE rsl.state = 1 AND rsl.deleted_at IS NULL
          AND SUBSTR(rsl.changed_at, 1, 10) = ?
        GROUP BY rsl.id
        ORDER BY rsl.id ASC
    "#;

    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("[日报生成] 查询状态变更日志失败: {}", e);
            return Vec::new();
        }
    };

    struct RawChange {
        requirement_id: i32,
        from_status: String,
        to_status: String,
        requirement_name: String,
        project_names: String,
    }

    let rows: Vec<RawChange> = match stmt.query_map(params![date], |row| {
        Ok(RawChange {
            requirement_id: row.get(0)?,
            from_status: row.get(1)?,
            to_status: row.get(2)?,
            requirement_name: row.get(3)?,
            project_names: row.get(4)?,
        })
    }) {
        Ok(mapped) => mapped.filter_map(|r| r.ok()).collect(),
        Err(e) => {
            log::warn!("[日报生成] 查询状态变更记录失败: {}", e);
            return Vec::new();
        }
    };

    // 对同一需求取最终的正向变更（to_status 序号最大的）
    let mut best: HashMap<i32, RawChange> = HashMap::new();
    for change in rows {
        if !is_forward_transition(&change.from_status, &change.to_status) {
            continue;
        }
        if exclude_ids.contains(&change.requirement_id) {
            continue;
        }
        let replace = match best.get(&change.requirement_id) {
            Some(existing) => status_order(&change.to_status) > status_order(&existing.to_status),
            None => true,
        };
        if replace {
            best.insert(change.requirement_id, change);
        }
    }

    let mut result: Vec<StatusChangeEntry> = best.into_values()
        .map(|c| StatusChangeEntry {
            requirement_name: c.requirement_name,
            project_names: c.project_names,
            to_status: c.to_status,
        })
        .collect();
    result.sort_by(|a, b| a.requirement_name.cmp(&b.requirement_name));
    result
}

fn append_status_changes(output: &mut String, conn: &Connection, date: &str, shown_requirement_ids: &HashSet<i32>) {
    let changes = load_forward_status_changes(conn, date, shown_requirement_ids);
    if changes.is_empty() {
        return;
    }

    log::info!("[日报生成] 当日正向状态变更数: {}", changes.len());
    output.push_str("\n## 状态变更:\n");
    for entry in &changes {
        let action = status_change_action_text(&entry.to_status);
        let project_display = if entry.project_names.is_empty() {
            String::new()
        } else {
            format!("【{}】", entry.project_names.replace(',', "/"))
        };
        output.push_str(&format!("- {}{} {}\n", project_display, entry.requirement_name, action));
    }
}

fn render_daily_other_work_only(commits: &[CommitInfo]) -> String {
    let mut output = String::new();
    append_other_work_by_project(&mut output, commits);
    output.trim().to_string()
}

fn append_other_work_by_project(buffer: &mut String, commits: &[CommitInfo]) {
    let grouped = group_commits_by_project(commits);
    if grouped.is_empty() {
        buffer.push_str("### 未关联项目\n1. 暂无工作项\n");
        return;
    }

    for (project_name, messages) in grouped {
        buffer.push_str(&format!("### {}\n", project_name));
        for (index, message) in messages.iter().enumerate() {
            buffer.push_str(&format!("{}. {}\n", index + 1, message));
        }
        buffer.push('\n');
    }
}

fn append_commit_lines(buffer: &mut String, commits: &[CommitInfo]) {
    let mut seen = HashSet::new();
    let mut ordered_messages: Vec<String> = Vec::new();

    for commit in commits {
        let message = normalize_commit_message(&commit.message);
        if message.is_empty() {
            continue;
        }
        if seen.insert(message.clone()) {
            ordered_messages.push(message);
        }
    }

    for (index, message) in ordered_messages.iter().enumerate() {
        buffer.push_str(&format!("{}. {}\n", index + 1, message));
    }
}

fn group_commits_by_project(commits: &[CommitInfo]) -> Vec<(String, Vec<String>)> {
    let mut project_order: Vec<String> = Vec::new();
    let mut grouped: HashMap<String, Vec<String>> = HashMap::new();

    for commit in commits {
        let project_name = if commit.project_name.trim().is_empty() {
            "未关联项目".to_string()
        } else {
            commit.project_name.clone()
        };

        if !grouped.contains_key(&project_name) {
            project_order.push(project_name.clone());
        }

        let message = normalize_commit_message(&commit.message);
        if !message.is_empty() {
            grouped.entry(project_name).or_default().push(message);
        }
    }

    let mut result: Vec<(String, Vec<String>)> = Vec::new();
    for project_name in project_order {
        let Some(messages) = grouped.remove(&project_name) else {
            continue;
        };

        let mut seen = HashSet::new();
        let deduped: Vec<String> = messages
            .into_iter()
            .filter(|message| seen.insert(message.clone()))
            .collect();

        if !deduped.is_empty() {
            result.push((project_name, deduped));
        }
    }

    result
}

fn format_requirement_projects(commits: &[CommitInfo]) -> String {
    let mut seen = HashSet::new();
    let mut ordered_projects: Vec<String> = Vec::new();

    for commit in commits {
        let project_name = if commit.project_name.trim().is_empty() {
            format!("项目{}", commit.project_id)
        } else {
            commit.project_name.clone()
        };

        if seen.insert(project_name.clone()) {
            ordered_projects.push(project_name);
        }
    }

    if ordered_projects.is_empty() {
        "未关联项目".to_string()
    } else {
        ordered_projects.join("/")
    }
}

fn normalize_commit_message(message: &str) -> String {
    message.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn format_requirement_status(status: &str) -> &'static str {
    match status {
        "presented" => "已宣讲",
        "pending_dev" => "待研发",
        "developing" => "开发中",
        "integrating" => "联调中",
        "pending_test" => "待测试",
        "testing" => "测试中",
        "pending_acceptance" => "待验收",
        "pending_release" => "待上线",
        "released" => "已上线",
        _ => "未知状态",
    }
}

fn is_merge_commit(message: &str) -> bool {
    let normalized = message.trim().to_lowercase();
    normalized.starts_with("merge branch")
        || normalized.starts_with("merge remote-tracking branch")
        || normalized.starts_with("merge pull request")
        || normalized.starts_with("merge !")
}

fn build_daily_template_reference(template: &str) -> String {
    let default_reference = "今日工作内容：\n1. 需求编号【项目名】需求名称（状态，环境）\n   1. 具体工作";
    if template.trim().is_empty() {
        return default_reference.to_string();
    }

    let mut selected_lines: Vec<String> = Vec::new();
    for line in template.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.contains("{{commits}}") || trimmed.contains("{commits}") {
            continue;
        }
        if trimmed.starts_with('#') || contains_any(trimmed, &["今日工作", "明日计划", "问题与风险"]) {
            selected_lines.push(trimmed.to_string());
        }
    }

    let mut normalized = selected_lines.join("\n");
    if normalized.trim().is_empty() {
        normalized = default_reference.to_string();
    }

    if !normalized.contains("今日工作内容") {
        normalized = format!("今日工作内容：\n{}", normalized);
    }

    if !normalized.contains("需求编号") {
        normalized.push_str("\n1. 需求编号【项目名】需求名称（状态，环境）\n   1. 具体工作");
    }

    normalized
}

fn contains_any(content: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|keyword| content.contains(keyword))
}

fn format_commits_text(project_commits: &HashMap<String, Vec<String>>) -> String {
    let mut text = String::new();
    for (project, msgs) in project_commits {
        text.push_str(&format!("## {}\n", project));
        for msg in msgs {
            text.push_str(&format!("- {}\n", msg));
        }
        text.push('\n');
    }
    text
}

/// 从当周已有日报聚合生成周报输入，同时返回项目-工作映射
fn build_weekly_summary_from_daily_reports_with_projects(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> (String, HashMap<String, Vec<String>>) {
    let mut stmt = match conn.prepare(
        "SELECT id, content, start_date FROM report \
         WHERE type = 'daily' AND state = 1 AND deleted_at IS NULL \
         AND start_date >= ? AND start_date <= ? \
         ORDER BY start_date ASC, id DESC",
    ) {
        Ok(stmt) => stmt,
        Err(_) => return (String::new(), HashMap::new()),
    };

    let reports: Vec<(String, String)> = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok((row.get::<_, String>(2)?, row.get::<_, String>(1)?))
        })
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    if reports.is_empty() {
        return (String::new(), HashMap::new());
    }

    // 每天只取最新一份日报（按 start_date 去重）
    let mut seen_dates = HashSet::new();
    let mut unique_contents: Vec<String> = Vec::new();
    for (date, content) in reports {
        if seen_dates.insert(date) {
            unique_contents.push(content);
        }
    }

    // 从日报内容提取项目-工作映射（保持项目出现顺序）
    let mut project_order: Vec<String> = Vec::new();
    let mut project_work: HashMap<String, Vec<String>> = HashMap::new();
    for content in unique_contents {
        extract_project_work_from_daily(&content, &mut project_work, &mut project_order);
    }

    if project_work.is_empty() {
        return (String::new(), HashMap::new());
    }

    // 格式化为周报输入（稳定输出顺序）
    let mut summary = String::new();
    for project in &project_order {
        let Some(items) = project_work.get(project) else {
            continue;
        };

        if items.is_empty() {
            continue;
        }

        summary.push_str(&format!("## {}\n", project));
        for item in items {
            summary.push_str(&format!("- {}\n", item));
        }
        summary.push('\n');
    }

    (summary, project_work)
}

/// 从日报 Markdown 内容中提取项目和工作项
fn extract_project_work_from_daily(
    content: &str,
    project_work: &mut HashMap<String, Vec<String>>,
    project_order: &mut Vec<String>,
) {
    let mut current_project = String::new();

    for line in content.lines() {
        let line = line.trim_end();
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // 匹配项目标题：## 项目名 / ### 项目名 / 数字. 项目名 / xxx【项目名】yyy
        if let Some(project) = extract_project_name(trimmed) {
            if !project_work.contains_key(&project) {
                project_order.push(project.clone());
                project_work.insert(project.clone(), Vec::new());
            }
            current_project = project;
            continue;
        }

        // 匹配工作项：- xxx / 数字. xxx
        if current_project.is_empty() {
            continue;
        }

        if let Some(item) = extract_work_item(line) {
            let item = item.trim();
            if item.is_empty() {
                continue;
            }

            let items = project_work.entry(current_project.clone()).or_default();
            if !items.contains(&item.to_string()) {
                items.push(item.to_string());
            }
        }
    }
}

fn extract_project_name(line: &str) -> Option<String> {
    // ## 项目名 / ### 项目名
    if line.starts_with("## ") || line.starts_with("### ") {
        let name = line.trim_start_matches('#').trim();
        if is_valid_project_name(name) {
            return Some(name.to_string());
        }
    }

    // 需求编号【项目名】xxx / ### ABC-123【项目名】xxx
    if let Some(project) = extract_bracket_project(line) {
        if is_valid_project_name(&project) {
            return Some(project);
        }
    }

    // 数字. 项目名（一级条目，非工作项）
    if let Some(candidate) = strip_numbered_list_prefix(line) {
        let candidate = candidate.trim();
        if looks_like_project_title(candidate) {
            return Some(candidate.to_string());
        }
    }

    None
}

fn extract_work_item(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // - xxx
    if let Some(item) = trimmed.strip_prefix("- ") {
        return Some(item.trim().to_string());
    }

    // 数字. xxx
    if let Some(item) = strip_numbered_list_prefix(trimmed) {
        let item = item.trim();
        if item.is_empty() {
            return None;
        }
        if contains_any(item, &["需求工作", "其他工作", "今日工作内容", "明日计划", "问题与风险"]) {
            return None;
        }
        return Some(item.to_string());
    }

    None
}

fn strip_numbered_list_prefix(line: &str) -> Option<&str> {
    let trimmed = line.trim_start();
    let without_digits = trimmed.trim_start_matches(|c: char| c.is_ascii_digit());
    if without_digits.len() == trimmed.len() {
        return None;
    }
    without_digits.strip_prefix(". ")
}

fn extract_bracket_project(line: &str) -> Option<String> {
    let start = line.find('【')?;
    let end = line[start..].find('】')? + start;
    let name = &line[start + '【'.len_utf8()..end];
    let name = name.trim();
    if name.is_empty() {
        return None;
    }

    if contains_any(name, &["结构化", "模板", "示例", "输入", "输出"]) {
        return None;
    }

    Some(name.to_string())
}

fn is_valid_project_name(name: &str) -> bool {
    let name = name.trim();
    if name.is_empty() {
        return false;
    }
    if contains_any(name, &["工作内容", "今日", "本周", "需求工作", "其他工作", "明日计划", "问题与风险"]) {
        return false;
    }
    true
}

fn looks_like_project_title(candidate: &str) -> bool {
    let candidate = candidate.trim();
    if candidate.is_empty() {
        return false;
    }
    if candidate.starts_with('-') {
        return false;
    }
    if candidate.len() > 30 {
        return false;
    }
    if contains_any(candidate, &["需求编号", "状态", "环境", "完成", "修复", "优化", "添加", "更新", "调整", "今日工作", "其他工作"]) {
        return false;
    }
    true
}

pub fn find_existing_report(conn: &Connection, req: &ReportGenerateReq) -> AppResult<Option<Report>> {
    let existing_id: Option<i32> = conn
        .query_row(
            "SELECT id FROM report WHERE type = ? AND start_date = ? AND end_date = ? AND state = 1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
            params![req.r#type, req.start_date, req.end_date],
            |row| row.get(0),
        )
        .optional()?;

    let Some(id) = existing_id else {
        return Ok(None);
    };

    // 如果历史数据存在重复记录，保留最新一条，其余做软删除，避免前端只取到旧记录
    let cleaned = conn.execute(
        "UPDATE report SET deleted_at = datetime('now','localtime'), state = 0 WHERE type = ? AND start_date = ? AND end_date = ? AND id != ? AND state = 1 AND deleted_at IS NULL",
        params![req.r#type, req.start_date, req.end_date, id],
    )?;
    if cleaned > 0 {
        log::info!(
            "[报告生成] 检测到重复报告，已清理 {} 条: type={}, {}~{}",
            cleaned,
            req.r#type,
            req.start_date,
            req.end_date
        );
    }

    Ok(Some(get_report_detail(conn, id)?))
}

pub fn generate_report_upsert(conn: &Connection, req: &ReportGenerateReq, ctx: &GenerateReportContext, content: &str) -> AppResult<Report> {
    if let Some(existing) = find_existing_report(conn, req)? {
        if req.append_existing && req.r#type == "daily" {
            let existing_summary = parse_commit_summary(&existing.commit_summary);
            let current_summary = parse_commit_summary(&ctx.commit_summary);
            let delta_commits = diff_project_commits(&current_summary, &existing_summary);
            let merged_content = merge_daily_report_content(&existing.content, &delta_commits);

            conn.execute(
                "UPDATE report SET title = ?, content = ?, commit_summary = ?, updated_at = datetime('now','localtime') WHERE id = ? AND state = 1 AND deleted_at IS NULL",
                params![existing.title, merged_content, ctx.commit_summary, existing.id],
            )?;
            return get_report_detail(conn, existing.id);
        }

        if req.force {
            let title = format!("{} ({} ~ {})", ctx.type_label, req.start_date, req.end_date);
            conn.execute(
                "UPDATE report SET title = ?, content = ?, commit_summary = ?, updated_at = datetime('now','localtime') WHERE id = ? AND state = 1 AND deleted_at IS NULL",
                params![title, content, ctx.commit_summary, existing.id],
            )?;
            return get_report_detail(conn, existing.id);
        }
        return Ok(existing);
    }

    let title = format!("{} ({} ~ {})", ctx.type_label, req.start_date, req.end_date);
    conn.execute(
        "INSERT INTO report (type, title, content, start_date, end_date, commit_summary) VALUES (?, ?, ?, ?, ?, ?)",
        params![req.r#type, title, content, req.start_date, req.end_date, ctx.commit_summary],
    )?;
    let id = conn.last_insert_rowid() as i32;
    get_report_detail(conn, id)
}

fn parse_commit_summary(summary_text: &str) -> HashMap<String, Vec<String>> {
    let parsed = serde_json::from_str::<HashMap<String, Vec<String>>>(summary_text).unwrap_or_default();
    normalize_project_commits(parsed)
}

fn normalize_project_commits(raw: HashMap<String, Vec<String>>) -> HashMap<String, Vec<String>> {
    let mut normalized: HashMap<String, Vec<String>> = HashMap::new();
    for (project, messages) in raw {
        let project_name = project.trim();
        if project_name.is_empty() {
            continue;
        }

        let mut unique: Vec<String> = Vec::new();
        let mut seen = HashSet::new();
        for message in messages {
            let trimmed = message.trim();
            if trimmed.is_empty() {
                continue;
            }
            if seen.insert(trimmed.to_string()) {
                unique.push(trimmed.to_string());
            }
        }

        if !unique.is_empty() {
            normalized.insert(project_name.to_string(), unique);
        }
    }
    normalized
}

fn diff_project_commits(
    current: &HashMap<String, Vec<String>>,
    baseline: &HashMap<String, Vec<String>>,
) -> HashMap<String, Vec<String>> {
    let mut delta: HashMap<String, Vec<String>> = HashMap::new();

    for (project, current_messages) in current {
        let baseline_set: HashSet<String> = baseline
            .get(project)
            .map(|items| items.iter().map(|item| item.trim().to_string()).collect())
            .unwrap_or_default();

        let mut new_items: Vec<String> = Vec::new();
        let mut seen = HashSet::new();
        for message in current_messages {
            let trimmed = message.trim();
            if trimmed.is_empty() {
                continue;
            }
            if baseline_set.contains(trimmed) {
                continue;
            }
            if seen.insert(trimmed.to_string()) {
                new_items.push(trimmed.to_string());
            }
        }

        if !new_items.is_empty() {
            delta.insert(project.clone(), new_items);
        }
    }

    delta
}

fn merge_daily_report_content(existing_content: &str, delta_commits: &HashMap<String, Vec<String>>) -> String {
    if delta_commits.is_empty() {
        return strip_daily_empty_placeholder(existing_content).to_string();
    }

    let supplement = render_delta_commits(delta_commits);
    let base = strip_daily_empty_placeholder(existing_content).trim_end();
    if base.is_empty() {
        return supplement;
    }
    format!("{}\n\n{}", base, supplement)
}

fn strip_daily_empty_placeholder(content: &str) -> &str {
    let trimmed = content.trim();
    if trimmed == "今日暂无工作内容" || trimmed == "今日暂无工作内容：" {
        return "";
    }
    content
}

fn render_delta_commits(delta_commits: &HashMap<String, Vec<String>>) -> String {
    let mut projects: Vec<&String> = delta_commits.keys().collect();
    projects.sort();

    let mut lines: Vec<String> = Vec::new();
    for project in projects {
        if let Some(messages) = delta_commits.get(project) {
            for message in messages {
                let normalized_message = message.trim();
                if normalized_message.is_empty() {
                    continue;
                }
                lines.push(format!("- 【{}】{}", project, normalized_message));
            }
        }
    }

    lines.join("\n")
}

pub fn generate_fallback(
    report_type: &str,
    structured_input: &str,
    project_commits: &HashMap<String, Vec<String>>,
    type_label: &str,
) -> String {
    let is_empty = structured_input.trim().is_empty() && project_commits.is_empty();
    if is_empty {
        return if report_type == "weekly" {
            "本周暂无工作内容".to_string()
        } else {
            "今日暂无工作内容".to_string()
        };
    }

    if report_type == "daily" {
        let normalized = structured_input.trim();
        if !normalized.is_empty() {
            return format!("今日工作内容：\n{}\n", normalized);
        }
    }

    let mut content = format!("# {}\n\n", type_label);
    for (project, msgs) in project_commits {
        content.push_str(&format!("## {}\n\n", project));
        for msg in msgs {
            content.push_str(&format!("- {}\n", msg));
        }
        content.push('\n');
    }
    content
}

pub fn update_report(conn: &Connection, req: &ReportUpdateReq) -> AppResult<()> {
    let mut sets = vec![];
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &req.title { sets.push("title = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.content { sets.push("content = ?"); pv.push(Box::new(v.clone())); }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now','localtime')");
        pv.push(Box::new(req.id));
        let sql = format!("UPDATE report SET {} WHERE id = ?", sets.join(", "));
        let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, refs.as_slice())?;
    }
    Ok(())
}

pub fn delete_report(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute("UPDATE report SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?", params![id])?;
    Ok(())
}

pub fn get_month_summary(conn: &Connection, req: &ReportMonthSummaryReq) -> AppResult<MonthSummaryRsp> {
    let start = format!("{:04}-{:02}-01", req.year, req.month);
    let end = if req.month == 12 {
        format!("{:04}-01-01", req.year + 1)
    } else {
        format!("{:04}-{:02}-01", req.year, req.month + 1)
    };

    let mut daily_stmt = conn.prepare(
        "SELECT id, title, start_date, end_date, created_at FROM report WHERE type = 'daily' AND state = 1 AND deleted_at IS NULL AND start_date >= ? AND start_date < ? ORDER BY start_date"
    )?;
    let daily_reports: Vec<ReportBrief> = daily_stmt.query_map(params![start, end], |row| {
        Ok(ReportBrief {
            id: row.get(0)?, title: row.get(1)?, start_date: row.get(2)?,
            end_date: row.get(3)?, created_at: row.get(4)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    let mut weekly_stmt = conn.prepare(
        "SELECT id, title, start_date, end_date, created_at FROM report WHERE type = 'weekly' AND state = 1 AND deleted_at IS NULL AND start_date >= ? AND start_date < ? ORDER BY start_date"
    )?;
    let weekly_reports: Vec<ReportBrief> = weekly_stmt.query_map(params![start, end], |row| {
        Ok(ReportBrief {
            id: row.get(0)?, title: row.get(1)?, start_date: row.get(2)?,
            end_date: row.get(3)?, created_at: row.get(4)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(MonthSummaryRsp { daily_reports, weekly_reports })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn strip_numbered_list_prefix_supports_multiple_digits() {
        assert_eq!(strip_numbered_list_prefix("1. 项目A"), Some("项目A"));
        assert_eq!(strip_numbered_list_prefix("10. 项目A"), Some("项目A"));
        assert_eq!(strip_numbered_list_prefix("001. 项目A"), Some("项目A"));
        assert_eq!(strip_numbered_list_prefix("- 项目A"), None);
        assert_eq!(strip_numbered_list_prefix("项目A"), None);
    }

    #[test]
    fn extract_project_name_handles_bracket_and_markdown_titles() {
        assert_eq!(extract_project_name("## DevSync"), Some("DevSync".to_string()));
        assert_eq!(extract_project_name("### DevSync"), Some("DevSync".to_string()));
        assert_eq!(
            extract_project_name("ABC-123【DevSync】优化日报"),
            Some("DevSync".to_string())
        );
        assert_eq!(extract_project_name("2. 其他工作"), None);
        assert_eq!(extract_project_name("1. 修复登录问题"), None);
    }

    #[test]
    fn extract_project_work_from_daily_keeps_indentation_items() {
        let content = r#"今日工作内容：
1. ABC-123【项目A】功能开发（状态: 开发中）
   1. 完成模块X
   2. 修复问题Y
2. 其他工作
   1. 项目B
      1. 优化性能
"#;

        let mut project_work = HashMap::new();
        let mut order = Vec::new();
        extract_project_work_from_daily(content, &mut project_work, &mut order);
        assert_eq!(order, vec!["项目A".to_string(), "项目B".to_string()]);
        assert_eq!(
            project_work.get("项目A").cloned().unwrap_or_default(),
            vec!["完成模块X".to_string(), "修复问题Y".to_string()]
        );
        assert_eq!(
            project_work.get("项目B").cloned().unwrap_or_default(),
            vec!["优化性能".to_string()]
        );
    }

    #[test]
    fn weekly_prepare_works_without_git_commits_when_daily_exists() {
        let conn = Connection::open_in_memory().expect("open memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        crate::db::schema::run_migrations(&conn).unwrap();

        conn.execute(
            "INSERT INTO report (type, title, content, start_date, end_date, commit_summary) VALUES ('daily', 'd1', ?, '2026-02-01', '2026-02-01', '')",
            params![
                "今日工作内容：\n1. ABC-123【项目A】功能开发（状态: 开发中）\n   1. 完成模块X\n\n",
            ],
        )
        .unwrap();

        let req = ReportGenerateReq {
            r#type: "weekly".to_string(),
            start_date: "2026-02-01".to_string(),
            end_date: "2026-02-07".to_string(),
            force: false,
            append_existing: false,
            author_email: None,
            project_ids: None,
        };

        let ctx = generate_report_prepare(&conn, &req).expect("weekly prepare");
        assert!(!ctx.structured_input.trim().is_empty());
        assert!(ctx.structured_input.contains("项目A"));
    }
}
