import { useCallback, useEffect } from 'react'

export function useUnsavedWarning(
  hasUnsavedChanges: boolean,
  message = '有未保存的修改，确定要离开吗？'
) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const confirmLeave = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true
    }
    return window.confirm(message)
  }, [hasUnsavedChanges, message])

  return { confirmLeave }
}
