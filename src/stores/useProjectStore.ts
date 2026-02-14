import { create } from 'zustand'
import { Project, ProjectDetail } from '@/api/project'

type DetailTab = 'overview' | 'commits' | 'iterations' | 'sql'

interface ProjectFormData {
  name: string
  description: string
  gitlab_url: string
  gitlab_token: string
  gitlab_project_id: string
  gitlab_branch: string
}

const INITIAL_FORM: ProjectFormData = {
  name: '',
  description: '',
  gitlab_url: '',
  gitlab_token: '',
  gitlab_project_id: '',
  gitlab_branch: '',
}

interface ProjectState {
  isModalOpen: boolean
  isDetailOpen: boolean
  activeTab: DetailTab
  selectedProject: ProjectDetail | null
  editingProject: Project | null
  syncingProjectId: number | null
  formData: ProjectFormData
  projectKeyword: string
}

interface ProjectActions {
  openAddModal: () => void
  openEditModal: (project: Project) => void
  closeModal: () => void
  setFormData: (data: Partial<ProjectFormData>) => void
  resetForm: () => void

  openDetail: (project: ProjectDetail) => void
  closeDetail: () => void
  switchTab: (tab: DetailTab) => void

  setSyncingProjectId: (id: number | null) => void
  setProjectKeyword: (keyword: string) => void
  setSelectedProject: (project: ProjectDetail | null) => void
}

export type { DetailTab, ProjectFormData }

export const useProjectStore = create<ProjectState & ProjectActions>()((set) => ({
  // --- 初始状态 ---
  isModalOpen: false,
  isDetailOpen: false,
  activeTab: 'overview' as DetailTab,
  selectedProject: null,
  editingProject: null,
  syncingProjectId: null,
  formData: { ...INITIAL_FORM },
  projectKeyword: '',

  // --- Actions ---
  openAddModal: () => set({ isModalOpen: true, editingProject: null, formData: { ...INITIAL_FORM } }),
  openEditModal: (project) => set({
    isModalOpen: true,
    editingProject: project,
    formData: {
      name: project.name,
      description: project.description || '',
      gitlab_url: project.gitlab_url || '',
      gitlab_token: project.gitlab_token || '',
      gitlab_project_id: project.gitlab_project_id ? String(project.gitlab_project_id) : '',
      gitlab_branch: project.gitlab_branch || '',
    },
  }),
  closeModal: () => set({ isModalOpen: false, editingProject: null }),
  setFormData: (data) => set((s) => ({ formData: { ...s.formData, ...data } })),
  resetForm: () => set({ formData: { ...INITIAL_FORM } }),

  openDetail: (project) => set({ isDetailOpen: true, selectedProject: project, activeTab: 'overview' }),
  closeDetail: () => set({ isDetailOpen: false, selectedProject: null }),
  switchTab: (tab) => set({ activeTab: tab }),

  setSyncingProjectId: (id) => set({ syncingProjectId: id }),
  setProjectKeyword: (keyword) => set({ projectKeyword: keyword }),
  setSelectedProject: (project) => set({ selectedProject: project }),
}))
