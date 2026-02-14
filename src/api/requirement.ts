import { invoke, PageResult } from "@/api";

export interface RequirementItem {
  id: number;
  name: string;
  requirement_code?: string;
  environment?: string;
  link?: string;
  iteration_id: number;
  status?: string;
  branch?: string;
  project_ids: number[];
  project_names: string[];
  sql_count: number;
  commit_count: number;
  created_at: string;
  updated_at: string;
  state: number;
}

export interface RequirementAddPayload {
  iteration_id: number;
  name: string;
  requirement_code?: string;
  environment?: string;
  link?: string;
  project_ids?: number[];
  status?: string;
  branch?: string;
}

export interface RequirementUpdatePayload {
  id: number;
  name?: string;
  requirement_code?: string;
  environment?: string;
  link?: string;
  project_ids?: number[];
  status?: string;
  branch?: string;
}

export interface RequirementStatusUpdatePayload {
  id: number;
  status: string;
}

export interface RequirementLinkPayload {
  requirement_id: number;
  link_type: string;
  link_id: number;
}

export interface RequirementCommitItem {
  id: number;
  project_id: number;
  project_name: string;
  commit_id: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
  additions: number;
  deletions: number;
  branch: string;
}

export interface RequirementCommitListReq {
  requirement_id: number;
  page?: number;
  size?: number;
  start_date?: string;
  end_date?: string;
}

export const requirementApi = {
  list: (iterationId: number) =>
    invoke<RequirementItem[]>("list_requirements", { req: { iteration_id: iterationId } }),
  listPage: (params: { iteration_id: number; page?: number; size?: number; status?: string; keyword?: string }) =>
    invoke<PageResult<RequirementItem>>("list_requirements_page", { req: params }),
  listCommits: (params: RequirementCommitListReq) =>
    invoke<PageResult<RequirementCommitItem>>("list_requirement_commits", { req: params }),
  add: (payload: RequirementAddPayload) =>
    invoke<number>("add_requirement", { req: payload }),
  update: (payload: RequirementUpdatePayload) =>
    invoke<void>("update_requirement", { req: payload }),
  updateStatus: (payload: RequirementStatusUpdatePayload) =>
    invoke<void>("update_requirement_status", { req: payload }),
  remove: (id: number) =>
    invoke<void>("delete_requirement", { id }),
  link: (payload: RequirementLinkPayload) =>
    invoke<void>("link_requirement", { req: payload }),
  linked: (linkType: string, linkId: number) =>
    invoke<RequirementItem | null>("get_linked_requirement", { linkType, linkId }),
};
