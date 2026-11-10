import { subtaskProgress, type IsoDate, type Project, type Subtask, type Task } from '../../domain'
import { TaskItem } from './TaskItem'

interface TaskListProps {
  tasks: readonly Task[]
  /** Subtasks grouped by task id. */
  subtasksByTask: ReadonlyMap<string, readonly Subtask[]>
  /** Pass to show each task's project (the "All tasks" view). */
  projectsById?: ReadonlyMap<string, Project>
  today: IsoDate
  onOpenTask: (taskId: string) => void
}

const NO_SUBTASKS: readonly Subtask[] = []

export function TaskList({ tasks, subtasksByTask, projectsById, today, onOpenTask }: TaskListProps) {
  return (
    <ul aria-label="Tasks" className="divide-y divide-line rounded-card border border-line bg-surface">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          today={today}
          subtasks={subtaskProgress(subtasksByTask.get(task.id) ?? NO_SUBTASKS)}
          projectName={projectsById?.get(task.projectId)?.name}
          onOpen={() => onOpenTask(task.id)}
        />
      ))}
    </ul>
  )
}
