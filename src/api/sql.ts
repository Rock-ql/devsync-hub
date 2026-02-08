import { invoke, PageResult } from "@/api";

export interface PendingSql {
  id: number;
  project_id: number;
  iteration_id: number;
  title: string;
  content: string;
  execution_order: number;
  status: string;
  executed_at: string | null;
  executed_env: string;
  remark: string;
  state: number;
  created_at: string;
  updated_at: string;
}

export interface EnvExecution {
  env_code: string;
  env_name: string;
  executed: boolean;
  executed_at: string | null;
  executor: string | null;
  remark: string | null;
}

export interface PendingSqlDetail {
  id: number;
  project_id: number;
  iteration_id: number;
  title: string;
  content: string;
  execution_order: number;
  status: string;
  executed_at: string | null;
  executed_env: string;
  remark: string;
  state: number;
  created_at: string;
  updated_at: string;
  project_name: string;
  iteration_name: string;
  env_executions: EnvExecution[];
  execution_status: string;
  completion_percent: number;
  linked_requirement: string | null;
}

export const sqlApi = {
  list: (params?: { page?: number; size?: number; project_id?: number; iteration_id?: number; status?: string; keyword?: string }) =>
    invoke<PageResult<PendingSqlDetail>>("list_sql", { req: params || {} }),
  detail: (id: number) =>
    invoke<PendingSqlDetail>("get_sql_detail", { id }),
  add: (data: { project_id: number; iteration_id: number; title: string; content: string; execution_order?: number; remark?: string }) =>
    invoke<number>("add_sql", { req: data }),
  update: (data: { id: number; title?: string; content?: string; execution_order?: number; remark?: string }) =>
    invoke<void>("update_sql", { req: data }),
  delete: (id: number) =>
    invoke<void>("delete_sql", { id }),
  execute: (data: { id: number; env: string; executor?: string; remark?: string }) =>
    invoke<void>("execute_sql", { req: data }),
  batchExecute: (data: { ids: number[]; env: string; executor?: string; remark?: string }) =>
    invoke<void>("batch_execute_sql", { req: data }),
  revokeExecution: (data: { sql_id: number; env: string }) =>
    invoke<void>("revoke_execution", { req: data }),
};
