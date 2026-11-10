import { describe, expect, it } from 'vitest'
import { makeProject, makeSubtask, makeTask, nextId, T0, USER_A, USER_B } from '../test/factories'
import { errorCode } from '../test/domainErrors'
import {
  createInboxProject,
  createProject,
  findInbox,
  planProjectDeletion,
  renameProject,
  sortProjects,
} from './projects'

const now = new Date('2026-02-01T10:00:00.000Z')
const NOW = '2026-02-01T10:00:00.000Z'


describe('createInboxProject', () => {
  it('creates the protected default project for a new user', () => {
    const id = nextId()
    expect(createInboxProject({ id, userId: USER_A, now })).toEqual({
      id,
      userId: USER_A,
      name: 'Inbox',
      isInbox: true,
      createdAt: NOW,
      updatedAt: NOW,
    })
  })
})

describe('createProject', () => {
  it('creates a regular project with timestamps', () => {
    const id = nextId()
    const project = createProject({ name: 'Thesis' }, [], { id, userId: USER_A, now })
    expect(project).toEqual({ id, userId: USER_A, name: 'Thesis', isInbox: false, createdAt: NOW, updatedAt: NOW })
  })

  it('rejects a name the user already uses, ignoring case and surrounding spaces', () => {
    const existing = [makeProject({ name: 'Thesis' })]
    expect(errorCode(() => createProject({ name: ' thesis ' }, existing, { id: nextId(), userId: USER_A, now }))).toBe(
      'DUPLICATE_PROJECT_NAME',
    )
  })

  it("allows the same name as another user's project", () => {
    const othersProject = makeProject({ userId: USER_B, name: 'Thesis' })
    const project = createProject({ name: 'Thesis' }, [othersProject], { id: nextId(), userId: USER_A, now })
    expect(project.name).toBe('Thesis')
  })

  it('compares names without locale-specific rules, so browser and server agree', () => {
    // In a Turkish locale, toLocaleLowerCase turns "I" into "ı"; plain lowercasing must be used.
    const existing = [makeProject({ name: 'IDEAS' })]
    expect(errorCode(() => createProject({ name: 'ideas' }, existing, { id: nextId(), userId: USER_A, now }))).toBe(
      'DUPLICATE_PROJECT_NAME',
    )
  })

  it('reserves the Inbox name', () => {
    expect(errorCode(() => createProject({ name: 'INBOX' }, [], { id: nextId(), userId: USER_A, now }))).toBe(
      'RESERVED_PROJECT_NAME',
    )
  })
})

describe('renameProject', () => {
  it('renames and bumps updatedAt', () => {
    const project = makeProject({ name: 'Old' })
    expect(renameProject(project, { name: 'New' }, [project], now)).toEqual({
      ...project,
      name: 'New',
      updatedAt: NOW,
    })
  })

  it('returns the same object when the name is unchanged', () => {
    const project = makeProject({ name: 'Same' })
    expect(renameProject(project, { name: 'Same' }, [project], now)).toBe(project)
  })

  it('allows changing only the capitalisation of its own name', () => {
    const project = makeProject({ name: 'thesis' })
    expect(renameProject(project, { name: 'Thesis' }, [project], now).name).toBe('Thesis')
  })

  it("rejects another of the user's project names", () => {
    const project = makeProject({ name: 'A' })
    const other = makeProject({ name: 'B' })
    expect(errorCode(() => renameProject(project, { name: 'b' }, [project, other], now))).toBe(
      'DUPLICATE_PROJECT_NAME',
    )
  })

  it('protects the Inbox and the reserved name', () => {
    const inbox = makeProject({ name: 'Inbox', isInbox: true })
    const project = makeProject({ name: 'A' })
    expect(errorCode(() => renameProject(inbox, { name: 'Other' }, [inbox], now))).toBe('INBOX_PROTECTED')
    expect(errorCode(() => renameProject(project, { name: 'inbox' }, [project], now))).toBe('RESERVED_PROJECT_NAME')
  })
})

describe('planProjectDeletion', () => {
  it("lists the project's tasks and their subtasks, and nothing else", () => {
    const project = makeProject()
    const otherProject = makeProject()
    const task1 = makeTask({ projectId: project.id })
    const task2 = makeTask({ projectId: project.id })
    const otherTask = makeTask({ projectId: otherProject.id })
    const subtask = makeSubtask({ taskId: task1.id })
    const otherSubtask = makeSubtask({ taskId: otherTask.id })

    const plan = planProjectDeletion(project, [task1, task2, otherTask], [subtask, otherSubtask])

    expect(plan).toEqual({ projectId: project.id, taskIds: [task1.id, task2.id], subtaskIds: [subtask.id] })
  })

  it('refuses to delete the Inbox', () => {
    const inbox = makeProject({ isInbox: true, name: 'Inbox' })
    expect(errorCode(() => planProjectDeletion(inbox, [], []))).toBe('INBOX_PROTECTED')
  })

  it("never includes another user's data, even if it references the project id", () => {
    const project = makeProject()
    const foreignTask = makeTask({ projectId: project.id, userId: USER_B })
    const foreignSubtask = makeSubtask({ taskId: foreignTask.id, userId: USER_B })

    expect(planProjectDeletion(project, [foreignTask], [foreignSubtask])).toEqual({
      projectId: project.id,
      taskIds: [],
      subtaskIds: [],
    })
  })
})

describe('findInbox and sortProjects', () => {
  it("finds the user's Inbox", () => {
    const inbox = makeProject({ isInbox: true, name: 'Inbox' })
    const othersInbox = makeProject({ isInbox: true, name: 'Inbox', userId: USER_B })
    expect(findInbox([makeProject(), othersInbox, inbox], USER_A)).toBe(inbox)
    expect(findInbox([makeProject()], USER_A)).toBeUndefined()
  })

  it('puts the Inbox first, then sorts by name naturally', () => {
    const projects = [
      makeProject({ name: 'project 10' }),
      makeProject({ name: 'Inbox', isInbox: true }),
      makeProject({ name: 'Project 2' }),
      makeProject({ name: 'apple' }),
    ]
    expect(sortProjects(projects).map((p) => p.name)).toEqual(['Inbox', 'apple', 'Project 2', 'project 10'])
  })

  it('does not mutate its input', () => {
    const projects = [makeProject({ name: 'b', createdAt: T0 }), makeProject({ name: 'a' })]
    const copy = [...projects]
    sortProjects(projects)
    expect(projects).toEqual(copy)
  })
})
