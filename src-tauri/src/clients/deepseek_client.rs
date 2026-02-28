use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub struct DeepSeekClient {
    base_url: String,
    api_key: String,
    http: reqwest::Client,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

impl DeepSeekClient {
    pub fn new(base_url: &str, api_key: &str) -> Self {
        let http = match reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
        {
            Ok(client) => client,
            Err(err) => {
                log::warn!("[DeepSeek] 构建HTTP客户端失败，回退默认配置: {}", err);
                reqwest::Client::new()
            }
        };

        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            http,
        }
    }

    async fn call_api(&self, system_prompt: &str, user_prompt: &str) -> AppResult<String> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                ChatMessage { role: "system".to_string(), content: system_prompt.to_string() },
                ChatMessage { role: "user".to_string(), content: user_prompt.to_string() },
            ],
            temperature: 0.7,
            max_tokens: 4096,
        };

        let resp = self.http.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalApi(format!("DeepSeek request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi(format!("DeepSeek API error {}: {}", status, text)));
        }

        let chat_resp: ChatResponse = resp.json()
            .await
            .map_err(|e| AppError::ExternalApi(format!("Failed to parse DeepSeek response: {}", e)))?;

        chat_resp.choices.first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| AppError::ExternalApi("Empty response from DeepSeek".into()))
    }

    pub async fn generate_daily_report(&self, structured_commits: &str, template: &str) -> AppResult<String> {
        const SYSTEM_PROMPT: &str = r#"你是一个专业的软件开发日报生成助手。

任务要求：
1. 严格基于输入内容输出，不编造不存在的需求和工作。
2. 模板仅作为格式参考，绝对禁止照搬模板中的历史业务条目、需求编号、项目名或具体工作点。
3. 输出内容必须完全来源于【结构化提交信息】。若模板与结构化提交信息冲突，以结构化提交信息为准。
4. 输出格式根据输入内容动态决定：
   - 如果【结构化提交信息】中有需求条目，则按如下格式输出：
     今日工作内容：
     1. 需求名称（状态，环境）
        1. 具体工作A
     2. 其他工作（仅当存在未关联需求的提交时才输出此分组）
        1. 项目名A
           1. 工作点A
   - 如果【结构化提交信息】中没有任何需求条目，则直接按项目分组输出，不加"其他工作"标题：
     今日工作内容：
     1. 项目名A
        1. 工作点A
     2. 项目名B
        1. 工作点B
5. 合并同一需求或项目下语义相近的提交信息，用一句话概括，避免逐条罗列琐碎提交。
6. 每条工作项应体现工作成果或效果，而非仅描述动作。例如"完成XX接口开发并联调通过"优于"开发XX接口"。
7. 一级条目使用阿拉伯数字编号，二级条目也使用阿拉伯数字编号。
8. 若某需求无环境信息，只保留状态，不要额外补充环境。
9. 如果【结构化提交信息】中包含「状态变更」节，必须将其中每条记录包含在日报输出中，不可删除。
   状态变更条目作为独立的一级条目输出，保持原文描述（如「完成上线」「提测」等）。"#;

        let user_prompt = format!(
            r#"请根据以下【按需求归类的结构化提交信息】和模板生成今日日报。

强制要求：
- 只能使用【结构化提交信息】里的需求名称、状态、环境、工作项（以及“其他工作”分组中的项目名）。
- 需求条目标题禁止输出需求编号和项目名，仅保留“需求名称（状态，环境）”。
- 不允许从模板中拷贝任何历史条目。
- 合并同一需求或项目下意思相近的提交，用简洁中文概括，体现完成效果。

【结构化提交信息】
{structured_commits}

【日报模板】
{template}"#,
        );

        self.call_api(SYSTEM_PROMPT, &user_prompt).await
    }

    pub async fn generate_weekly_report(&self, weekly_summary: &str, template: &str) -> AppResult<String> {
        const SYSTEM_PROMPT: &str = r#"你是一个专业的软件开发周报生成助手。

任务要求：
1. 严格基于输入内容输出，不编造不存在的项目和工作。
2. 周报中的详细工作小点必须挂在项目名下面。
3. 输出结构优先按项目分组，每个项目下列出本周工作小点。
4. 模板仅作为格式参考，禁止拷贝模板中的历史业务条目。
5. 一级和二级条目都使用阿拉伯数字编号。
6. 若输入已将多个仓库/模块归并到同一项目名，输出时必须保持该归并，不可再拆分。
7. 合并同一项目下语义相近或围绕同一功能点的工作项，用一句话概括，避免罗列琐碎条目。
8. 每条工作项应体现工作成果或效果，而非仅描述动作。例如"完成XX功能开发并通过测试"优于"开发XX功能"。

Markdown格式强制要求：
- 禁止使用 1.1、1.2、2.1 这种小数点编号格式。
- 二级条目必须使用缩进3个空格 + 阿拉伯数字编号的标准Markdown嵌套列表格式。
- 正确示例：
1. 项目A
   1. 完成功能X开发并通过联调验证
   2. 修复问题Y，提升页面加载性能
2. 项目B
   1. 优化模块Z性能，接口响应时间降低"#;

        let user_prompt = format!(
            r#"请根据以下【当周工作汇总信息】和模板生成周报。

强制要求：
- 详细工作小点必须放在项目名下面。
- 只能使用输入中已有的项目与工作内容。
- 将同一项目下意思相近的工作项合并精简，用简洁中文概括，体现完成效果。

【当周工作汇总信息】
{weekly_summary}

【周报模板】
{template}"#,
        );

        self.call_api(SYSTEM_PROMPT, &user_prompt).await
    }
}
