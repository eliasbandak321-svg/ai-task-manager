import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
}

export type ShowToast = (message: string, tone?: ToastTone) => void

/** Shows a short notification that is also announced to screen readers (see components/dashboard/Toaster). */
export const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}
