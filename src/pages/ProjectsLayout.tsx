import { Outlet } from 'react-router'
import { ProjectNav } from '../components/dashboard/ProjectNav'

/** Projects section: the project list beside the tasks of the selected project. */
export function ProjectsLayout() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <ProjectNav />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
