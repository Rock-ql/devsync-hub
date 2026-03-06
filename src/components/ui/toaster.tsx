import * as React from 'react'
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast'

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type ToastState = {
  toasts: ToasterToast[]
}

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 1000

type ToastActionType =
  | {
      type: 'ADD_TOAST'
      toast: ToasterToast
    }
  | {
      type: 'UPDATE_TOAST'
      toast: Partial<ToasterToast> & { id: string }
    }
  | {
      type: 'DISMISS_TOAST'
      toastId?: string
    }
  | {
      type: 'REMOVE_TOAST'
      toastId?: string
    }

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

let memoryState: ToastState = { toasts: [] }

const listeners: Array<(state: ToastState) => void> = []

let toastCount = 0

function generateToastId() {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER
  return toastCount.toString()
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: 'REMOVE_TOAST', toastId })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

function reducer(state: ToastState, action: ToastActionType): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }
    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.toast.id ? { ...toast, ...action.toast } : toast
        ),
      }
    case 'DISMISS_TOAST': {
      const { toastId } = action
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id))
      }
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toastId === undefined || toast.id === toastId
            ? {
                ...toast,
                open: false,
              }
            : toast
        ),
      }
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return { ...state, toasts: [] }
      }
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
      }
    default:
      return state
  }
}

function dispatch(action: ToastActionType) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type ToastInput = Omit<ToasterToast, 'id'>

type ToastReturn = {
  id: string
  dismiss: () => void
  update: (props: Partial<ToasterToast>) => void
}

type ToastCreator = ((props: ToastInput) => ToastReturn) & {
  success: (
    message: React.ReactNode,
    options?: Omit<ToastInput, 'variant'>
  ) => ToastReturn
  error: (
    message: React.ReactNode,
    options?: Omit<ToastInput, 'variant'>
  ) => ToastReturn
}

function createToast(props: ToastInput): ToastReturn {
  const id = generateToastId()

  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })

  const update = (toast: Partial<ToasterToast>) =>
    dispatch({ type: 'UPDATE_TOAST', toast: { ...toast, id } })

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          dismiss()
        }
      },
    },
  })

  return {
    id,
    dismiss,
    update,
  }
}

const toast = ((props: ToastInput) => createToast(props)) as ToastCreator

toast.success = (message, options) =>
  createToast({
    duration: 2500,
    ...options,
    title: options?.title ?? '成功',
    description: options?.description ?? message,
    variant: 'success',
  })

toast.error = (message, options) =>
  createToast({
    duration: 4000,
    ...options,
    title: options?.title ?? '错误',
    description: options?.description ?? message,
    variant: 'error',
  })

function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({ type: 'DISMISS_TOAST', toastId }),
  }
}

function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title ? <ToastTitle>{title}</ToastTitle> : null}
            {description ? <ToastDescription>{description}</ToastDescription> : null}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export { Toaster, useToast, toast, type ToastActionElement }
