import { createContext, useContext } from 'react'
import type { WorkspaceClient } from './workspaceClient'

/** The workspace API the app talks to: HTTP in the app, an in-memory fake in tests. */
export const WorkspaceContext = createContext<WorkspaceClient | null>(null)

export function useWorkspace(): WorkspaceClient {
  const client = useContext(WorkspaceContext)
  if (!client) throw new Error('useWorkspace must be used inside a WorkspaceContext provider')
  return client
}
