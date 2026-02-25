import { useCallback, useRef, useState } from 'react'

interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean
}

const INITIAL_STATE: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  confirmText: '确认',
  cancelText: '取消',
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(INITIAL_STATE)
  const pendingActionRef = useRef<null | (() => void)>(null)

  const closeConfirm = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }))
    pendingActionRef.current = null
  }, [])

  const openConfirm = useCallback((options: ConfirmDialogOptions, action: () => void) => {
    pendingActionRef.current = action
    setDialogState({
      open: true,
      title: options.title,
      description: options.description ?? '',
      confirmText: options.confirmText ?? '确认',
      cancelText: options.cancelText ?? '取消',
    })
  }, [])

  const handleConfirm = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    action?.()
  }, [])

  return {
    dialogState,
    openConfirm,
    closeConfirm,
    handleConfirm,
  }
}
