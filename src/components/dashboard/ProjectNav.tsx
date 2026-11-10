import { ChevronDown, FolderPlus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router'
import { computeProjectProgress } from '../../domain'
import { useProjectsQuery, useTasksQuery } from '../../hooks/queries'
import { useToday } from '../../hooks/useToday'
import { Button } from '../ui/Button'
import { ProjectFormDialog } from './ProjectFormDialog'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center justify-between gap-3 rounded-control px-3 text-sm transition-colors duration-(--duration-fast) ${
    isActive ? 'bg-raised font-semibold text-ink' : 'text-ink-muted hover:bg-raised/60 hover:text-ink'
  }`

/**
 * Project navigation (decided at the start of M5, docs/design.md §10): a sidebar on large
 * screens; on small screens a "Projects" button that expands the same list, so the task
 * list stays at the top of the page.
 */
export function ProjectNav() {
  const projectsQuery = useProjectsQuery()
  const tasksQuery = useTasksQuery()
  const today = useToday()
  const navigate = useNavigate()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const [creating, setCreating] = useState(false)

  const projects = projectsQuery.data
  const progress = useMemo(
    () => computeProjectProgress(projects ?? [], tasksQuery.data ?? [], today),
    [projects, tasksQuery.data, today],
  )

  const projectMatch = useMatch('/app/projects/:projectId')
  const currentName = projectMatch
    ? (projects?.find((project) => project.id === projectMatch.params.projectId)?.name ?? 'Project')
    : 'All tasks'

  const collapse = () => setExpanded(false)

  return (
    // On large screens the sidebar scrolls on its own and keeps bottom padding, so a long
    // project list can always be scrolled clear of the notification corner (see Toaster).
    <nav
      aria-label="Projects"
      className="lg:sticky lg:top-26 lg:max-h-[calc(100svh-6.5rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:pb-20"
    >
      <Button
        variant="secondary"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
        className="w-full justify-between lg:hidden"
      >
        <span className="truncate">
          <span className="text-ink-muted">Projects:</span> {currentName}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform duration-(--duration-fast) ${expanded ? 'rotate-180' : ''}`}
        />
      </Button>

      <div id={listId} className={`${expanded ? 'block' : 'hidden'} mt-3 lg:mt-0 lg:block`}>
        <div className="flex items-center justify-between gap-2 pl-3">
          <h2 className="text-eyebrow font-medium uppercase text-ink-subtle">Projects</h2>
          <Button variant="ghost" iconOnly aria-label="New project" title="New project" onClick={() => setCreating(true)}>
            <FolderPlus aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <ul className="mt-1 space-y-1">
          <li>
            <NavLink to="/app" end className={linkClass} onClick={collapse}>
              All tasks
            </NavLink>
          </li>
          {projects?.map((project) => {
            const percent = progress.get(project.id)?.completionPercent ?? 0
            return (
              <li key={project.id}>
                <NavLink
                  to={`/app/projects/${project.id}`}
                  aria-label={`${project.name}, ${percent}% done`}
                  className={linkClass}
                  onClick={collapse}
                >
                  <span className="truncate">{project.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-subtle">{percent}%</span>
                </NavLink>
              </li>
            )
          })}
        </ul>

        {projectsQuery.isPending && (
          <output className="block px-3 py-2 text-sm text-ink-subtle">Loading projects…</output>
        )}
        {projectsQuery.isError && (
          <p role="alert" className="px-3 py-2 text-sm text-danger">
            Projects couldn't be loaded.
          </p>
        )}
      </div>

      {creating && (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSaved={(project) => {
            collapse()
            navigate(`/app/projects/${project.id}`)
          }}
        />
      )}
    </nav>
  )
}
