import { useState, type FormEvent } from 'react'
import { createProjectInputSchema, isDomainError, type Project } from '../../domain'
import { useCreateProject, useUpdateProject } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field } from '../ui/Field'
import { controlClass } from '../ui/styles'

interface ProjectFormDialogProps {
  /** The project to rename; omit to create a new one. */
  project?: Project
  onClose: () => void
  onSaved?: (project: Project) => void
}

/** Creates a project, or renames one. Validation uses the same Zod schema as the repository. */
export function ProjectFormDialog({ project, onClose, onSaved }: ProjectFormDialogProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [error, setError] = useState<string>()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const toast = useToast()
  const pending = createProject.isPending || updateProject.isPending

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createProjectInputSchema.safeParse({ name })
    if (!parsed.success) {
      setError(errorMessage(parsed.error))
      return
    }
    if (project && parsed.data.name === project.name) {
      onClose()
      return
    }
    try {
      const saved = project
        ? await updateProject.mutateAsync({ id: project.id, input: parsed.data })
        : await createProject.mutateAsync(parsed.data)
      toast(project ? `Renamed to “${saved.name}”` : `Created “${saved.name}”`)
      onClose()
      onSaved?.(saved)
    } catch (caught) {
      // Duplicate and reserved names are rule violations: show them on the field.
      setError(isDomainError(caught) ? caught.message : errorMessage(caught))
    }
  }

  return (
    <Dialog title={project ? 'Rename project' : 'New project'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="mt-5">
        <Field label="Project name" error={error}>
          {(control) => (
            <input
              {...control}
              data-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              className={controlClass}
            />
          )}
        </Field>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : project ? 'Save name' : 'Create project'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
