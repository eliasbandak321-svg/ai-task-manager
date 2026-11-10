import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_FILTERS, parseTaskFilters, toSearchParams, type TaskFilters } from '../lib/taskFilters'

/**
 * Search, filters and sorting, stored in the URL (see src/lib/taskFilters.ts).
 * Changes *replace* the current history entry, so typing a search doesn't fill the Back button.
 */
export function useTaskFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseTaskFilters(params), [params])

  const setFilters = useCallback(
    (changes: Partial<TaskFilters>) => setParams(toSearchParams({ ...filters, ...changes }), { replace: true }),
    [filters, setParams],
  )

  /** Clears search and filters, keeping the chosen sort order. */
  const clearFilters = useCallback(
    () =>
      setParams(
        toSearchParams({ ...DEFAULT_FILTERS, sortBy: filters.sortBy, sortDirection: filters.sortDirection }),
        { replace: true },
      ),
    [filters, setParams],
  )

  return { filters, setFilters, clearFilters }
}
