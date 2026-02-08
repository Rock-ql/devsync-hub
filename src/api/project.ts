import { invoke, PageResult } from "@/api";

export interface Project {
  id: number;
  name: string;
  description: string;
  gitlab_url: string;
  gitlab_token: string;
  gitlab_project_id: number;
  gitlab_branch: string;
  state: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail {
  id: number;
  name: string;
  description: string;
  gitlab_url: string;
  gitlab_token: string;
  gitlab_project_id: number;
  gitlab_branch: string;
  state: number;
  created_at: string;
  updated_at: string;
  iteration_count: number;
  pending_sql_count: number;
  has_gitlab_config: boolean;
}

export interface GitCommit {
  id: number;
  project_id: number;
  commit_id: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
  additions: number;
  deletions: number;
  branch: string;
}

export const projectApi = {
  list: (params?: { page?: number; size?: number; keyword?: string }) =>
    invoke<PageResult<ProjectDetail>>("list_projects", { req: params || {} }),
  listAll: () =>
    invoke<Project[]>("list_all_projects"),
  detail: (id: number) =>
    invoke<ProjectDetail>("get_project_detail", { id }),
  add: (data: Partial<Project>) =>
    invoke<number>("add_project", { req: data }),
  update: (data: Partial<Project> & { id: number }) =>
    invoke<void>("update_project", { req: data }),
  delete: (id: number) =>
    invoke<void>("delete_project", { id }),
  syncCommits: (id: number) =>
    invoke<number>("sync_commits", { id }),
  getCommits: (projectId: number) =>
    invoke<GitCommit[]>("get_commits", { projectId }),
  listBranches: (params: { project_id?: number; gitlab_url?: string; gitlab_token?: string; gitlab_project_id?: number }) =>
    invoke<string[]>("list_gitlab_branches", { req: params }),
};
