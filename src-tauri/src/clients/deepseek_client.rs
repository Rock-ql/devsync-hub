use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

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
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            http: reqwest::Client::new(),
        }
    }

    pub async fn chat(&self, prompt: &str) -> AppResult<String> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = ChatRequest {
            model: "deepseek-chat".to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "你是一个专业的软件开发项目助手，擅长根据Git提交记录生成结构化的工作日报和周报。".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                },
            ],
            temperature: 0.7,
        };

        let resp = self.http.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalApi(format!("DeepSeek request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi(format!("DeepSeek API error {}: {}", status, body)));
        }

        let chat_resp: ChatResponse = resp.json()
            .await
            .map_err(|e| AppError::ExternalApi(format!("Failed to parse DeepSeek response: {}", e)))?;

        chat_resp.choices.first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| AppError::ExternalApi("Empty response from DeepSeek".into()))
    }
}
