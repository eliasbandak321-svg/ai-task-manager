import { Search, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import {
  DEADLINE_FILTERS,
  LIMITS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_SORT_FIELDS,
  TASK_STATUSES,
  type TaskQuery,
} from '../../domain'
import { countActiveFilters, type TaskFilters } from '../../lib/taskFilters'
import { Button } from '../ui/Button'
import { checkboxClass, controlClass, labelClass } from '../ui/styles'

interface TaskToolbarProps {
  filters: TaskFilters
  onChange: (changes: Partial<TaskFilters>) => void
  onClear: () => void
}

const DEADLINE_LABELS: Record<TaskQuery['deadline'], string> = {
  any: 'Any deadline',
  overdue: 'Overdue',
  due_today: 'Due today',
  due_soon: 'Due in the next 3 days',
  no_date: 'No deadline',
}

const SORT_LABELS: Record<TaskQuery['sortBy'], string> = {
  due_date: 'Deadline',
  priority: 'Priority',
  status: 'Status',
  title: 'Title',
  created_at: 'Date created',
  updated_at: 'Last updated',
}

const chipClass =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 text-sm text-ink-muted transition-colors duration-(--duration-fast) hover:border-ink-subtle has-checked:border-glow has-checked:text-ink'

/** Toggles a value in a list (used by the status and priority checkboxes). */
function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  return on ? [...list, value] : list.filter((item) => item !== value)
}

/** Search, filters and sorting. On small screens the filters fold away behind a button. */
export function TaskToolbar({ filters, onChange, onClear }: TaskToolbarProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const searchId = useId()
  const deadlineId = useId()
  const sortId = useId()
  const directionId = useId()
  const activeCount = countActiveFilters(filters)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search tasks
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          />
          <input
            id={searchId}
            type="search"
            value={filters.search}
            maxLength={LIMITS.searchQuery}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search tasks"
            className={`${controlClass} pl-9`}
          />
        </div>
        <Button
          variant="secondary"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
          className="lg:hidden"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filters{activeCount > 0 && ` (${activeCount})`}
        </Button>
      </div>

      <div id={panelId} className={`${expanded ? 'flex' : 'hidden'} flex-col gap-4 lg:flex lg:flex-row lg:flex-wrap lg:items-end`}>
        <fieldset>
          <legend className={`${labelClass} mb-1.5`}>Status</legend>
          <div className="flex flex-wrap gap-2">
            {TASK_STATUSES.map((status) => (
              <label key={status} className={chipClass}>
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={filters.statuses.includes(status)}
                  onChange={(event) => onChange({ statuses: toggle(filters.statuses, status, event.target.checked) })}
                />
                {STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={`${labelClass} mb-1.5`}>Priority</legend>
          <div className="flex flex-wrap gap-2">
            {[...TASK_PRIORITIES].reverse().map((priority) => (
              <label key={priority} className={chipClass}>
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={filters.priorities.includes(priority)}
                  onChange={(event) =>
                    onChange({ priorities: toggle(filters.priorities, priority, event.target.checked) })
                  }
                />
                {PRIORITY_LABELS[priority]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
          <div className="space-y-1.5">
            <label htmlFor={deadlineId} className={labelClass}>
              Deadline
            </label>
            <select
              id={deadlineId}
              value={filters.deadline}
              onChange={(event) => onChange({ deadline: event.target.value as TaskFilters['deadline'] })}
              className={controlClass}
            >
              {DEADLINE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {DEADLINE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={sortId} className={labelClass}>
              Sort by
            </label>
            <select
              id={sortId}
              value={filters.sortBy}
              onChange={(event) => onChange({ sortBy: event.target.value as TaskFilters['sortBy'] })}
              className={controlClass}
            >
              {TASK_SORT_FIELDS.map((value) => (
                <option key={value} value={value}>
                  {SORT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={directionId} className={labelClass}>
              Order
            </label>
            <select
              id={directionId}
              value={filters.sortDirection}
              onChange={(event) => onChange({ sortDirection: event.target.value as TaskFilters['sortDirection'] })}
              className={controlClass}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" onClick={onClear} className="self-start lg:self-end">
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
