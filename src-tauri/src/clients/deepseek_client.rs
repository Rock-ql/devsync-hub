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
5. 对同一需求或项目下的提交，按以下规则处理：
   - 若多条提交是【同一件事的重复描述或进度补充】（如"修改XX接口"+"调整XX接口参数"），合并为一条；
   - 若多条提交描述的是【不同方向的工作】（如"完成列表接口开发"和"修复导出功能BUG"），保留为独立工作点，不强制合并；
   - 同一需求或项目下可输出 1-5 个独立工作点；
   - 禁止逐条复制原始提交消息，禁止保留相同含义的重复描述。
6. 每条工作项应体现工作成果或效果，而非仅描述动作，如果提交信息描述的有误或是表达不够清晰，可以进行优化。例如"完成XX接口开发并联调通过"优于"开发XX接口"。
8. 一级条目使用阿拉伯数字编号，二级条目也使用阿拉伯数字编号。
11. 禁止使用Markdown加粗语法（**文字**），所有条目均使用纯文本。
9. 若某需求无环境信息，只保留状态，不要额外补充环境。
10. 如果【结构化提交信息】中包含「状态变更」节，必须将其中每条记录包含在日报输出中，不可删除。
   状态变更条目作为独立的一级条目输出，保持原文描述（如「完成上线」「提测」等）。"#;

        let user_prompt = format!(
            r#"请根据以下【按需求归类的结构化提交信息】和模板生成今日日报。

强制要求：
- 只能使用【结构化提交信息】里的需求名称、状态、环境、工作项（以及“其他工作”分组中的项目名）。
- 需求条目标题禁止输出需求编号和项目名，仅保留“需求名称（状态，环境）”。
- 不允许从模板中拷贝任何历史条目。
- 对同一需求或项目下的提交：只合并"同一件事的冗余重复描述"，对语义不同的工作点保留为独立条目（每个需求/项目 1-5 条），用简洁中文概括各工作的完成效果。

【结构化提交信息】
{structured_commits}

【日报模板】
{template}"#,
        );

        self.call_api(SYSTEM_PROMPT, &user_prompt).await
    }

    pub async fn generate_weekly_report(&self, weekly_summary: &str, template: &str) -> AppResult<String> {
        let (system_prompt, user_prompt) = build_weekly_report_prompts(weekly_summary, template);
        self.call_api(&system_prompt, &user_prompt).await
    }
}

fn build_weekly_report_prompts(weekly_summary: &str, template: &str) -> (String, String) {
    let system_prompt = r#"你是一个专业的软件开发周报生成助手。

任务要求：
1. 严格基于输入内容输出，不编造不存在的项目和工作。
2. 周报必须包含两个部分：「## 本周工作总结」和「## 下周工作计划」，不要有其他标题。
3. 本周工作总结：按项目分组，每个项目下列出本周工作小点。
4. 下周工作计划：只生成全局 2-4 条简短计划，不按项目分组，不要根据本周每条工作逐条生成。
5. 下周工作计划优先提炼未完成、进行中、待联调、待提测、待修复、待上线等未闭环事项；已完成且已闭环的内容默认不要写入下周计划。
6. 若输入里无法明确判断未完成事项，可以概括为少量通用推进项，但仍需保持简短，禁止展开成长清单。
7. 模板仅作为格式参考，禁止拷贝模板中的历史业务条目。
8. 若输入已将多个仓库/模块归并到同一项目名，输出时必须保持该归并，不可再拆分。
9. 本周工作总结中的同一项目下，只合并围绕同一功能点的冗余或进度性描述；不同功能方向保留为独立条目（每个项目 1-6 条）。
10. 每条工作项应体现工作成果或效果，而非仅描述动作。例如“完成XX功能开发并通过联调验证”优于“开发XX功能”。
11. 禁止使用Markdown加粗语法（**文字**），所有条目均使用纯文本。

Markdown格式强制要求：
- 禁止使用 1.1、1.2、2.1 这种小数点编号格式。
- 禁止使用Markdown加粗语法（**文字**）。
- 本周工作总结保持项目分组：一级条目为项目名，二级条目为工作小点，二级条目必须使用缩进3个空格 + 阿拉伯数字编号。
- 下周工作计划使用一级阿拉伯数字编号直接列出 2-4 条短计划，不再使用项目分组或嵌套编号。
- 正确示例：
## 本周工作总结
1. 项目A
   1. 完成功能X开发并通过联调验证
   2. 修复问题Y，提升页面加载性能
2. 项目B
   1. 优化模块Z性能，接口响应时间降低

## 下周工作计划
1. 完成功能X剩余开发并安排提测。
2. 跟进问题Y回归验证，处理测试反馈。
3. 推进模块Z剩余优化并完成联调。"#;

    let user_prompt = format!(
        r#"请根据以下【当周工作汇总信息】和模板生成周报，必须包含「本周工作总结」和「下周工作计划」两个部分。

强制要求：
- 本周工作总结：详细工作小点必须放在项目名下面，只能使用输入中已有的项目与工作内容。
- 下周工作计划：输出全局 2-4 条简短计划，不按项目分组，不要根据本周每条工作逐条生成。
- 下周工作计划优先围绕未完成、进行中、待联调、待提测、待修复、待上线等未闭环事项提炼；若无法识别明确状态，可概括少量通用推进项，但不要写成长清单。
- 对同一项目下的工作项：只合并同一功能点的冗余描述，对不同功能方向的工作保留独立条目（每个项目 1-6 条），用简洁中文概括各工作的完成效果。
- 禁止使用Markdown加粗语法（**文字**），所有条目使用纯文本。

【当周工作汇总信息】
{weekly_summary}

【周报模板】
{template}"#,
    );

    (system_prompt.to_string(), user_prompt)
}

#[cfg(test)]
mod tests {
    use super::build_weekly_report_prompts;

    #[test]
    fn weekly_prompts_require_short_global_next_week_plan() {
        let (system_prompt, user_prompt) = build_weekly_report_prompts("## 项目A\n- 完成功能X\n", "模板");

        assert!(system_prompt.contains("只生成全局 2-4 条简短计划"));
        assert!(system_prompt.contains("不按项目分组"));
        assert!(system_prompt.contains("不要根据本周每条工作逐条生成"));
        assert!(user_prompt.contains("优先围绕未完成、进行中、待联调、待提测、待修复、待上线等未闭环事项提炼"));
        assert!(user_prompt.contains("输出全局 2-4 条简短计划"));
    }
}
