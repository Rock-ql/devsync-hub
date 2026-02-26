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

function readString(obj: Record<string, unknown>, snake: string, camel?: string): string {
  const value = obj[snake] ?? (camel ? obj[camel] : undefined);
  return typeof value === "string" ? value : "";
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeReport(raw: unknown): Report {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    id: readNumber(obj, "id"),
    type: readString(obj, "type"),
    title: readString(obj, "title"),
    content: readString(obj, "content"),
    start_date: readString(obj, "start_date", "startDate"),
    end_date: readString(obj, "end_date", "endDate"),
    commit_summary: readString(obj, "commit_summary", "commitSummary"),
    state: readNumber(obj, "state"),
    created_at: readString(obj, "created_at", "createdAt"),
    updated_at: readString(obj, "updated_at", "updatedAt"),
  };
}

function normalizeReportBrief(raw: unknown): ReportBrief {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    id: readNumber(obj, "id"),
    title: readString(obj, "title"),
    start_date: readString(obj, "start_date", "startDate"),
    end_date: readString(obj, "end_date", "endDate"),
    created_at: readString(obj, "created_at", "createdAt"),
  };
}

function normalizeMonthSummary(raw: unknown): MonthSummary {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const dailyRaw = obj.daily_reports ?? obj.dailyReports;
  const weeklyRaw = obj.weekly_reports ?? obj.weeklyReports;
  return {
    daily_reports: Array.isArray(dailyRaw) ? dailyRaw.map((item) => normalizeReportBrief(item)) : [],
    weekly_reports: Array.isArray(weeklyRaw) ? weeklyRaw.map((item) => normalizeReportBrief(item)) : [],
  };
}

function normalizeReportPage(raw: unknown): PageResult<Report> {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const recordsRaw = obj.records;
  return {
    records: Array.isArray(recordsRaw) ? recordsRaw.map((item) => normalizeReport(item)) : [],
    total: readNumber(obj, "total"),
    page: readNumber(obj, "page"),
    size: readNumber(obj, "size"),
  };
}

export const reportApi = {
  list: (params?: { page?: number; size?: number; type?: string; keyword?: string }) =>
    invoke<unknown>("list_reports", { req: params || {} }).then(normalizeReportPage),
  detail: (id: number) =>
    invoke<unknown>("get_report_detail", { id }).then(normalizeReport),
  generate: (data: { type: string; start_date: string; end_date: string; force?: boolean; append_existing?: boolean; author_email?: string; project_ids?: number[] }) =>
    invoke<unknown>("generate_report", { req: data }).then(normalizeReport),
  update: (data: { id: number; title?: string; content?: string }) =>
    invoke<void>("update_report", { req: data }),
  delete: (id: number) =>
    invoke<void>("delete_report", { id }),
  monthSummary: (year: number, month: number) =>
    invoke<unknown>("get_month_summary", { req: { year, month } }).then(normalizeMonthSummary),
};
