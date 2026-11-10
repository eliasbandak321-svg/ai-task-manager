import { describe, expect, it } from 'vitest'
import { TASK_PRIORITIES, TASK_STATUSES } from './constants'
import { PRIORITY_LABELS, STATUS_LABELS } from './labels'

describe('labels', () => {
  it('uses the approved status names', () => {
    expect(TASK_STATUSES.map((status) => STATUS_LABELS[status])).toEqual(['To do', 'In progress', 'Done'])
  })

  it('labels every priority', () => {
    expect(TASK_PRIORITIES.map((priority) => PRIORITY_LABELS[priority])).toEqual(['Low', 'Medium', 'High'])
  })
})
