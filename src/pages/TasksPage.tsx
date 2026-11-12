import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { DeleteProjectDialog } from '../components/dashboard/DeleteProjectDialog'
import { NotFoundMessage } from '../components/dashboard/NotFoundMessage'
import { ProjectFormDialog } from '../components/dashboard/ProjectFormDialog'
import { QuickAddTask } from '../components/dashboard/QuickAddTask'
import { StatsPanel } from '../components/dashboard/StatsPanel'
import { TaskDialog } from '../components/dashboard/TaskDialog'
import { TaskList } from '../components/dashboard/TaskList'
import { TaskToolbar } from '../components/dashboard/TaskToolbar'
import { Button } from '../components/ui/Button'
import { EmptyMessage } from '../components/ui/EmptyMessage'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { computeTaskStats, getTaskSubtasks, queryTasks, type Subtask, type Task } from '../domain'
import { useProjectsQuery, useSubtasksQuery, useTasksQuery } from '../hooks/queries'
import { useTaskFilters } from '../hooks/useTaskFilters'
import { useToday } from '../hooks/useToday'
import { errorMessage, pluralize } from '../lib/format'
import { countActiveFilters } from '../lib/taskFilters'

type OpenDialog =
  | { type: 'new-task' }
  | { type: 'task'; taskId: string }
  | { type: 'rename-project' }
  | { type: 'delete-project' }
  | null

const NONE: never[] = []

/**
 * The main dashboard page. Without a project in the URL it shows every task ("All tasks");
 * with /app/projects/:projectId it shows one project. All rules (statistics, search, filters,
 * sorting, deletion counts) come from src/domain; this component only wires them to the UI.
 */
export function TasksPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const today = useToday()
  const { filters, setFilters, clearFilters } = useTaskFilters()
  const [dialog, setDialog] = useState<OpenDialog>(null)

  const projectsQuery = useProjectsQuery()
  const tasksQuery = useTasksQuery()
  const subtasksQuery = useSubtasksQuery()
  const projects = projectsQuery.data ?? NONE
  const tasks = tasksQuery.data ?? NONE
  const subtasks = subtasksQuery.data ?? NONE

  const project = projectId ? projects.find((candidate) => candidate.id === projectId) : undefined
  // The repository only returns the current user's projects, so there is exactly one Inbox.
  const inbox = projects.find((candidate) => candidate.isInbox)

  const scopeTasks = useMemo(
    () => (project ? tasks.filter((task) => task.projectId === project.id) : tasks),
    [project, tasks],
  )
  const stats = useMemo(() => computeTaskStats(scopeTasks, today), [scopeTasks, today])
  const visibleTasks = useMemo(() => queryTasks(scopeTasks, { ...filters, projectId: null }, today), [scopeTasks, filters, today])
  const projectsById = useMemo(() => new Map(projects.map((candidate) => [candidate.id, candidate])), [projects])
  const subtasksByTask = useMemo(() => {
    const grouped = new Map<string, Subtask[]>()
    for (const subtask of subtasks) grouped.set(subtask.taskId, [...(grouped.get(subtask.taskId) ?? []), subtask])
    return grouped
  }, [subtasks])

  // ---------- Loading, error and not-found states ----------

  const queries = [projectsQuery, tasksQuery, subtasksQuery]
  if (queries.some((query) => query.isError)) {
    const failed = queries.find((query) => query.isError)
    return (
      <ErrorMessage
        title="Your tasks couldn't be loaded"
        message={errorMessage(failed?.error)}
        onRetry={() => queries.forEach((query) => query.isError && void query.refetch())}
      />
    )
  }
  if (queries.some((query) => query.isPending) || !inbox) {
    return <LoadingMessage label="Loading your tasks…" />
  }
  if (projectId && !project) {
    return (
      <NotFoundMessage title="Project not found">
        This project doesn't exist. It may have been deleted.
      </NotFoundMessage>
    )
  }

  // ---------- Page ----------

  const heading = project?.name ?? 'All tasks'
  const activeFilters = countActiveFilters(filters)
  const resultText =
    activeFilters > 0
      ? `Showing ${visibleTasks.length} of ${pluralize(scopeTasks.length, 'task')}`
      : pluralize(scopeTasks.length, 'task')
  const openTask: Task | undefined =
    dialog?.type === 'task' ? tasks.find((task) => task.id === dialog.taskId) : undefined
  const closeDialog = () => setDialog(null)

  return (
    <div className="space-y-6">
      <title>{`${heading} · AI Task Manager`}</title>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h2 font-semibold break-words text-ink">{heading}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {!project
              ? 'Every task, across all your projects.'
              : project.isInbox
                ? 'Your default project. It can’t be renamed or deleted.'
                : 'A project and its tasks.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setDialog({ type: 'new-task' })}>
            <Plus aria-hidden="true" className="size-4" />
            New task
          </Button>
          {project && !project.isInbox && (
            <>
              <Button
                variant="secondary"
                aria-label="Rename project"
                onClick={() => setDialog({ type: 'rename-project' })}
              >
                <Pencil aria-hidden="true" className="size-4" />
                Rename
              </Button>
              <Button
                variant="secondary"
                aria-label="Delete project"
                onClick={() => setDialog({ type: 'delete-project' })}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <StatsPanel title={project ? `Progress in ${project.name}` : 'Overall progress'} stats={stats} />

      <section aria-labelledby="tasks-heading" className="space-y-4">
        <h2 id="tasks-heading" className="sr-only">
          Tasks
        </h2>
        <QuickAddTask projectId={(project ?? inbox).id} projectName={(project ?? inbox).name} />
        <TaskToolbar filters={filters} onChange={setFilters} onClear={clearFilters} />
        {/* <output> is a polite live region: screen readers hear how many tasks match. */}
        <output className="block text-sm text-ink-subtle">{resultText}</output>

        {scopeTasks.length === 0 ? (
          <EmptyMessage title="No tasks yet">
            Add your first task above. Press Enter to save it and keep typing the next one.
          </EmptyMessage>
        ) : visibleTasks.length === 0 ? (
          <EmptyMessage
            title="No tasks match your filters"
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          >
            Try a different search, or clear the filters to see every task.
          </EmptyMessage>
        ) : (
          <TaskList
            tasks={visibleTasks}
            subtasksByTask={subtasksByTask}
            projectsById={project ? undefined : projectsById}
            today={today}
            onOpenTask={(taskId) => setDialog({ type: 'task', taskId })}
          />
        )}
      </section>

      {dialog?.type === 'new-task' && (
        <TaskDialog mode="create" defaultProjectId={(project ?? inbox).id} projects={projects} onClose={closeDialog} />
      )}
      {openTask && (
        <TaskDialog
          mode="edit"
          task={openTask}
          subtasks={getTaskSubtasks(subtasks, openTask)}
          projects={projects}
          onClose={closeDialog}
        />
      )}
      {project && dialog?.type === 'rename-project' && <ProjectFormDialog project={project} onClose={closeDialog} />}
      {project && dialog?.type === 'delete-project' && (
        <DeleteProjectDialog
          project={project}
          tasks={tasks}
          subtasks={subtasks}
          onClose={closeDialog}
          onDeleted={() => {
            closeDialog()
            navigate('/app/projects')
          }}
        />
      )}
    </div>
  )
}
