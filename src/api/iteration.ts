import { invoke, PageResult } from "@/api";

export interface Iteration {
  id: number;
  project_id: number;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  state: number;
  created_at: string;
  updated_at: string;
}

export interface IterationDetail {
  id: number;
  project_id: number;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  state: number;
  created_at: string;
  updated_at: string;
  project_ids: number[];
  project_names: string[];
  requirement_count: number;
  pending_sql_count: number;
}

export const iterationApi = {
  list: (params?: { page?: number; size?: number; project_id?: number; status?: string; keyword?: string }) =>
    invoke<PageResult<IterationDetail>>("list_iterations", { req: params || {} }),
  listByProject: (projectId: number) =>
    invoke<Iteration[]>("list_by_project", { projectId }),
  detail: (id: number) =>
    invoke<IterationDetail>("get_iteration_detail", { id }),
  add: (data: { name: string; description?: string; status?: string; start_date?: string; end_date?: string; project_ids?: number[] }) =>
    invoke<number>("add_iteration", { req: data }),
  update: (data: { id: number; name?: string; description?: string; status?: string; start_date?: string; end_date?: string; project_ids?: number[] }) =>
    invoke<void>("update_iteration", { req: data }),
  delete: (id: number) =>
    invoke<void>("delete_iteration", { id }),
  updateStatus: (id: number, status: string) =>
    invoke<void>("update_iteration_status", { id, status }),
};
