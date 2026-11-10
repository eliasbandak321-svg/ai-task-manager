import { planProjectDeletion, type Project, type Subtask, type Task } from '../../domain'
import { useDeleteProject } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { errorMessage, pluralize } from '../../lib/format'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface DeleteProjectDialogProps {
  project: Project
  tasks: readonly Task[]
  subtasks: readonly Subtask[]
  onClose: () => void
  onDeleted: () => void
}

/**
 * Confirms deleting a project (docs/design.md §10). The counts come from the domain's
 * planProjectDeletion, the same function that decides what the repository deletes.
 */
export function DeleteProjectDialog({ project, tasks, subtasks, onClose, onDeleted }: DeleteProjectDialogProps) {
  const toast = useToast()
  const deleteProject = useDeleteProject({
    onDeleted: () => {
      toast(`Deleted “${project.name}”`)
      onDeleted()
    },
  })
  const plan = planProjectDeletion(project, tasks, subtasks)
  const taskCount = plan.taskIds.length
  const subtaskCount = plan.subtaskIds.length

  const contents =
    taskCount === 0
      ? 'It has no tasks.'
      : `All of its tasks and subtasks will be permanently deleted: ${pluralize(taskCount, 'task')}${
          subtaskCount > 0 ? ` and ${pluralize(subtaskCount, 'subtask')}` : ''
        }.`

  return (
    <ConfirmDialog
      title={`Delete “${project.name}”?`}
      description={
        <>
          <p>
            This permanently deletes the project “{project.name}”. {contents}
          </p>
          <p className="font-medium text-ink">This can't be undone.</p>
        </>
      }
      confirmLabel={taskCount === 0 ? 'Delete project' : `Delete project and ${pluralize(taskCount, 'task')}`}
      pending={deleteProject.isPending}
      error={deleteProject.isError ? errorMessage(deleteProject.error) : null}
      onCancel={onClose}
      // Errors are shown in the dialog (deleteProject.error), so the rejection needs no handler here.
      onConfirm={() => deleteProject.mutateAsync(project.id).catch(() => {})}
    />
  )
}
