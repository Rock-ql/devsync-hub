import { invoke } from "@tauri-apps/api/core";

export { invoke };

export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  size: number;
}

export interface PageReq {
  page?: number;
  size?: number;
}
