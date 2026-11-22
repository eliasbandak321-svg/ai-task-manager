import { createContext, use } from 'react'
import { IS_DEMO } from './demoMode'

/** Whether the app is running as the portfolio demo (M11). Defaults to the build flag; tests set it. */
export const DemoContext = createContext<boolean>(IS_DEMO)

export function useIsDemo(): boolean {
  return use(DemoContext)
}
