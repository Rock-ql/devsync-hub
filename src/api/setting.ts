import { invoke } from "@/api";

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  description: string;
}

export interface ApiKeyItem {
  id: number;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiKeyCreateResult {
  id: number;
  name: string;
  key: string;
  key_prefix: string;
}

export interface ImportResult {
  total: number;
  tables: { table: string; count: number }[];
}

export const settingApi = {
  getAll: () =>
    invoke<SystemSetting[]>("get_all_settings"),
  update: (key: string, value: string) =>
    invoke<void>("update_setting", { req: { key, value } }),
  batchUpdate: (settings: Record<string, string>) =>
    invoke<void>("batch_update_settings", { req: { settings } }),
  createApiKey: (name: string) =>
    invoke<ApiKeyCreateResult>("create_api_key", { req: { name } }),
  listApiKeys: () =>
    invoke<ApiKeyItem[]>("list_api_keys"),
  deleteApiKey: (id: number) =>
    invoke<void>("delete_api_key", { id }),
  importData: (jsonContent: string) =>
    invoke<ImportResult>("import_data", { jsonContent }),
  exportData: () =>
    invoke<string>("export_data"),
};
