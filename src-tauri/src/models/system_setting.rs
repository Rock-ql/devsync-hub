use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemSetting {
    pub id: i32,
    pub setting_key: String,
    pub setting_value: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingUpdateReq {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchSettingUpdateReq {
    pub settings: std::collections::HashMap<String, String>,
}
