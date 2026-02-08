import { invoke, PageResult } from "@/api";

export interface Report {
  id: number;
  type: string;
  title: string;
  content: string;
  start_date: string;
  end_date: string;
  commit_summary: string;
  state: number;
  created_at: string;
  updated_at: string;
}

export interface ReportBrief {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface MonthSummary {
  daily_reports: ReportBrief[];
  weekly_reports: ReportBrief[];
}

export const reportApi = {
  list: (params?: { page?: number; size?: number; type?: string; keyword?: string }) =>
    invoke<PageResult<Report>>("list_reports", { req: params || {} }),
  detail: (id: number) =>
    invoke<Report>("get_report_detail", { id }),
  generate: (data: { type: string; start_date: string; end_date: string; author_email?: string; project_ids?: number[] }) =>
    invoke<Report>("generate_report", { req: data }),
  update: (data: { id: number; title?: string; content?: string }) =>
    invoke<void>("update_report", { req: data }),
  delete: (id: number) =>
    invoke<void>("delete_report", { id }),
  monthSummary: (year: number, month: number) =>
    invoke<MonthSummary>("get_month_summary", { req: { year, month } }),
};
