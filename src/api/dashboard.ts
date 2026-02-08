import { invoke } from "@/api";

export interface DashboardOverview {
  project_count: number;
  active_project_count: number;
  iteration_count: number;
  active_iteration_count: number;
  pending_sql_count: number;
  requirement_count: number;
  today_commit_count: number;
  week_commit_count: number;
  recent_projects: RecentProject[];
  recent_iterations: RecentIteration[];
  pending_sql_by_project: ProjectPendingCount[];
}

export interface RecentProject {
  id: number;
  name: string;
  pending_sql_count: number;
  updated_at: string;
}

export interface RecentIteration {
  id: number;
  name: string;
  status: string;
  updated_at: string;
}

export interface ProjectPendingCount {
  project_id: number;
  project_name: string;
  count: number;
}

export const dashboardApi = {
  overview: () => invoke<DashboardOverview>("get_overview"),
};
