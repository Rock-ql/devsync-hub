import { create } from 'zustand'
import { PendingSqlDetail } from '@/api/sql'
import { EnvExecutionItem } from '@/components/sql/EnvExecutionButtons'

interface SqlFormData {
  projectId: string
  iterationId: string
  title: string
  content: string
  remark: string
}

const INITIAL_FORM: SqlFormData = {
  projectId: '',
  iterationId: '',
  title: '',
  content: '',
  remark: '',
}

interface SqlState {
  // 筛选
  selectedStatus: string
  selectedProjectId: string

  // 新增对话框
  isModalOpen: boolean
  formData: SqlFormData

  // 编辑
  editingId: number | null
  editForm: { title: string; content: string; remark: string }
  hasUnsavedChanges: boolean

  // 执行对话框
  executeDialogOpen: boolean
  executeDialogMode: 'execute' | 'detail'
  selectedEnv: EnvExecutionItem | null
  selectedSql: PendingSqlDetail | null
  executeEnvCode: string
  executeRemark: string

  // 批量操作
  selectedSqlIds: Set<number>
  batchExecuteDialogOpen: boolean
  batchExecuteEnvCode: string
  batchExecuteRemark: string

  // 预览
  previewDialogOpen: boolean
  previewSql: PendingSqlDetail | null

  // 环境配置
  envConfigDialogOpen: boolean
  envConfigProjectId: number | null

  // 需求关联
  linkDialogOpen: boolean
  linkSqlId: number | null
}

interface SqlActions {
  setFilter: (status: string, projectId: string) => void
  setSelectedStatus: (status: string) => void
  setSelectedProjectId: (id: string) => void

  openAddModal: () => void
  closeAddModal: () => void
  setFormData: (data: Partial<SqlFormData>) => void
  resetForm: () => void

  startEdit: (sql: PendingSqlDetail) => void
  cancelEdit: () => void
  setEditForm: (data: Partial<{ title: string; content: string; remark: string }>) => void
  setHasUnsavedChanges: (v: boolean) => void
  clearEdit: () => void

  openExecuteDialog: (sql: PendingSqlDetail, env: EnvExecutionItem, mode: 'execute' | 'detail') => void
  closeExecuteDialog: () => void
  setExecuteEnvCode: (code: string) => void
  setExecuteRemark: (remark: string) => void

  toggleSelectSql: (id: number) => void
  selectAllSql: (ids: number[]) => void
  clearSelectedSql: () => void
  openBatchExecuteDialog: () => void
  closeBatchExecuteDialog: () => void
  setBatchExecuteEnvCode: (code: string) => void
  setBatchExecuteRemark: (remark: string) => void
  resetBatchExecute: () => void

  openPreview: (sql: PendingSqlDetail) => void
  closePreview: () => void

  openEnvConfig: (projectId: number) => void
  closeEnvConfig: () => void

  openLinkDialog: (sqlId: number) => void
  closeLinkDialog: () => void
}

export const useSqlStore = create<SqlState & SqlActions>()((set) => ({
  // --- 初始状态 ---
  selectedStatus: '',
  selectedProjectId: '',
  isModalOpen: false,
  formData: { ...INITIAL_FORM },
  editingId: null,
  editForm: { title: '', content: '', remark: '' },
  hasUnsavedChanges: false,
  executeDialogOpen: false,
  executeDialogMode: 'execute',
  selectedEnv: null,
  selectedSql: null,
  executeEnvCode: '',
  executeRemark: '',
  selectedSqlIds: new Set(),
  batchExecuteDialogOpen: false,
  batchExecuteEnvCode: '',
  batchExecuteRemark: '',
  previewDialogOpen: false,
  previewSql: null,
  envConfigDialogOpen: false,
  envConfigProjectId: null,
  linkDialogOpen: false,
  linkSqlId: null,

  // --- Actions ---
  setFilter: (status, projectId) => set({ selectedStatus: status, selectedProjectId: projectId, selectedSqlIds: new Set() }),
  setSelectedStatus: (status) => set({ selectedStatus: status, selectedSqlIds: new Set() }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id, selectedSqlIds: new Set() }),

  openAddModal: () => set({ isModalOpen: true }),
  closeAddModal: () => set({ isModalOpen: false }),
  setFormData: (data) => set((s) => ({ formData: { ...s.formData, ...data } })),
  resetForm: () => set({ formData: { ...INITIAL_FORM } }),

  startEdit: (sql) => set({
    editingId: sql.id,
    editForm: { title: sql.title, content: sql.content, remark: sql.remark || '' },
    hasUnsavedChanges: false,
  }),
  cancelEdit: () => set({ editingId: null, hasUnsavedChanges: false }),
  setEditForm: (data) => set((s) => ({ editForm: { ...s.editForm, ...data }, hasUnsavedChanges: true })),
  setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),
  clearEdit: () => set({ editingId: null, editForm: { title: '', content: '', remark: '' }, hasUnsavedChanges: false }),

  openExecuteDialog: (sql, env, mode) => set({
    executeDialogOpen: true,
    executeDialogMode: mode,
    selectedSql: sql,
    selectedEnv: env,
    executeEnvCode: env.envCode,
    executeRemark: '',
  }),
  closeExecuteDialog: () => set({
    executeDialogOpen: false,
    selectedEnv: null,
    selectedSql: null,
    executeRemark: '',
  }),
  setExecuteEnvCode: (code) => set({ executeEnvCode: code }),
  setExecuteRemark: (remark) => set({ executeRemark: remark }),

  toggleSelectSql: (id) => set((s) => {
    const next = new Set(s.selectedSqlIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    return { selectedSqlIds: next }
  }),
  selectAllSql: (ids) => set({ selectedSqlIds: new Set(ids) }),
  clearSelectedSql: () => set({ selectedSqlIds: new Set() }),
  openBatchExecuteDialog: () => set({ batchExecuteDialogOpen: true }),
  closeBatchExecuteDialog: () => set({ batchExecuteDialogOpen: false }),
  setBatchExecuteEnvCode: (code) => set({ batchExecuteEnvCode: code }),
  setBatchExecuteRemark: (remark) => set({ batchExecuteRemark: remark }),
  resetBatchExecute: () => set({
    batchExecuteDialogOpen: false,
    batchExecuteEnvCode: '',
    batchExecuteRemark: '',
    selectedSqlIds: new Set(),
  }),

  openPreview: (sql) => set({ previewDialogOpen: true, previewSql: sql }),
  closePreview: () => set({ previewDialogOpen: false, previewSql: null }),

  openEnvConfig: (projectId) => set({ envConfigDialogOpen: true, envConfigProjectId: projectId }),
  closeEnvConfig: () => set({ envConfigDialogOpen: false, envConfigProjectId: null }),

  openLinkDialog: (sqlId) => set({ linkDialogOpen: true, linkSqlId: sqlId }),
  closeLinkDialog: () => set({ linkDialogOpen: false, linkSqlId: null }),
}))
