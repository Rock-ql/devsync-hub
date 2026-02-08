import { invoke } from "@/api";

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

export const requirementApi = {
  list: (iterationId: number) =>
    invoke<RequirementItem[]>("list_requirements", { req: { iteration_id: iterationId } }),
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
