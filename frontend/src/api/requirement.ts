import api from '@/api'

export interface RequirementItem {
  id: number
  name: string
  requirementCode?: string
  environment?: string
  link?: string
  iterationId: number
  status?: string
  statusDesc?: string
  branch?: string
  projectIds: number[]
  projectNames: string[]
  linkedSqlCount: number
  linkedCommitCount: number
  createdAt: string
}

export interface RequirementAddPayload {
  iterationId: number
  name: string
  requirementCode?: string
  environment?: string
  link?: string
  projectIds?: number[]
  status?: string
  branch?: string
}

export interface RequirementUpdatePayload {
  id: number
  name: string
  requirementCode?: string
  environment?: string
  link?: string
  projectIds?: number[]
  status?: string
  branch?: string
}

export interface RequirementStatusUpdatePayload {
  id: number
  status: string
}

export interface RequirementLinkPayload {
  requirementId: number
  linkType: 'sql' | 'commit'
  linkId: number
}

export const requirementApi = {
  list: (iterationId: number, keyword?: string) =>
    api.post<RequirementItem[]>('/requirement/list', { iterationId, keyword }),
  add: (payload: RequirementAddPayload) => api.post<number>('/requirement/add', payload),
  update: (payload: RequirementUpdatePayload) => api.post('/requirement/update', payload),
  updateStatus: (payload: RequirementStatusUpdatePayload) => api.post('/requirement/status', payload),
  remove: (id: number) => api.post('/requirement/delete', { id }),
  link: (payload: RequirementLinkPayload) => api.post('/requirement/link', payload),
}
