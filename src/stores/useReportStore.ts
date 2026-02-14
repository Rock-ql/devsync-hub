import { create } from 'zustand'
import { format, isValid, startOfMonth } from 'date-fns'

interface WeekRow {
  weekNumber: number
  weekStart: Date
  weekEnd: Date
}

type PanelState =
  | { mode: 'daily'; date: Date }
  | { mode: 'weekly'; week: WeekRow }

interface GenerateForm {
  type: string
  startDate: string
  endDate: string
  authorEmail: string
  force: boolean
}

interface EditForm {
  title: string
  content: string
}

interface ReportState {
  safeToday: Date
  selectedMonth: Date
  panelState: PanelState

  // 生成对话框
  isGenerateModalOpen: boolean
  generateForm: GenerateForm

  // 编辑
  isEditing: boolean
  hasUnsavedChanges: boolean
  editForm: EditForm
  copySuccess: boolean

  // 搜索
  reportSearchKeyword: string
  reportSearchPage: number
}

function formatSafeDate(value: Date, pattern: string, fallbackText: string): string {
  return isValid(value) ? format(value, pattern) : fallbackText
}

interface ReportActions {
  setSelectedMonth: (month: Date) => void
  setPanelState: (state: PanelState) => void

  openGenerateModal: () => void
  closeGenerateModal: () => void
  setGenerateForm: (data: Partial<GenerateForm>) => void
  resetGenerateForm: () => void

  startEdit: (title: string, content: string) => void
  cancelEdit: () => void
  setEditForm: (data: Partial<EditForm>) => void
  setHasUnsavedChanges: (v: boolean) => void
  setCopySuccess: (v: boolean) => void

  setReportSearchKeyword: (keyword: string) => void
  setReportSearchPage: (page: number) => void
}

export type { PanelState, WeekRow, GenerateForm, EditForm }

export const useReportStore = create<ReportState & ReportActions>()((set, get) => {
  const today = new Date()
  const todayStr = formatSafeDate(today, 'yyyy-MM-dd', '')

  return {
    // --- 初始状态 ---
    safeToday: today,
    selectedMonth: startOfMonth(today),
    panelState: { mode: 'daily', date: today },

    isGenerateModalOpen: false,
    generateForm: {
      type: 'daily',
      startDate: todayStr,
      endDate: todayStr,
      authorEmail: '',
      force: false,
    },

    isEditing: false,
    hasUnsavedChanges: false,
    editForm: { title: '', content: '' },
    copySuccess: false,

    reportSearchKeyword: '',
    reportSearchPage: 1,

    // --- Actions ---
    setSelectedMonth: (month) => set({ selectedMonth: month }),
    setPanelState: (state) => set({ panelState: state }),

    openGenerateModal: () => set({ isGenerateModalOpen: true }),
    closeGenerateModal: () => set({ isGenerateModalOpen: false }),
    setGenerateForm: (data) => set((s) => ({ generateForm: { ...s.generateForm, ...data } })),
    resetGenerateForm: () => {
      const t = get().safeToday
      const d = formatSafeDate(t, 'yyyy-MM-dd', '')
      set({
        isGenerateModalOpen: false,
        generateForm: { type: 'daily', startDate: d, endDate: d, authorEmail: '', force: false },
      })
    },

    startEdit: (title, content) => set({
      isEditing: true,
      editForm: { title, content },
      hasUnsavedChanges: false,
    }),
    cancelEdit: () => set({ isEditing: false, hasUnsavedChanges: false, editForm: { title: '', content: '' } }),
    setEditForm: (data) => set((s) => ({ editForm: { ...s.editForm, ...data }, hasUnsavedChanges: true })),
    setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),
    setCopySuccess: (v) => set({ copySuccess: v }),

    setReportSearchKeyword: (keyword) => set({ reportSearchKeyword: keyword, reportSearchPage: 1 }),
    setReportSearchPage: (page) => set({ reportSearchPage: page }),
  }
})
