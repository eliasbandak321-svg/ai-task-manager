import { createContext, useContext } from 'react'
import type { TaskRepository } from './repository'

/**
 * Which repository the dashboard talks to. The app provides the local adapter (M5) and later
 * the HTTP adapter (M6); tests provide one backed by in-memory storage.
 */
export const RepositoryContext = createContext<TaskRepository | null>(null)

export function useRepository(): TaskRepository {
  const repository = useContext(RepositoryContext)
  if (!repository) throw new Error('useRepository must be used inside a RepositoryContext provider')
  return repository
}
