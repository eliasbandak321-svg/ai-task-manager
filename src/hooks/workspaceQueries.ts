import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { ApplyProposalInput, EditScope, PlanRequest, Preferences, TaskAssistKind } from '../domain'
import { useWorkspace } from '../data/workspaceContext'
import type { CreateEventRequest, EventChange, ScheduleRequest } from '../data/workspaceClient'
import { queryKeys } from './queries'

/*
  TanStack Query hooks for the M9 workspace (calendar, scheduling, proposals, insights, AI).
  After every change the affected lists are refetched, so the UI shows what the server stored.
*/

export const workspaceKeys = {
  preferences: ['preferences'],
  calendar: ['calendar'],
  calendarRange: (from: string, to: string) => ['calendar', from, to],
  proposals: ['proposals'],
  insights: ['insights'],
  dependencies: ['dependencies'],
  effort: ['effort'],
  aiStatus: ['ai', 'status'],
  conversations: ['ai', 'conversations'],
  messages: (id: string) => ['ai', 'conversations', id],
} as const

/** The browser's IANA time zone (used for defaults until the user saves settings). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

export function usePreferencesQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.preferences, queryFn: () => client.getPreferences(browserTimeZone()) })
}

/**
 * The user's time zone from their settings: authoritative for the calendar, deadlines and
 * scheduling. Until the settings load (or are saved) it is the device's zone.
 */
export function useUserTimeZone(): string {
  const preferences = usePreferencesQuery()
  return preferences.data?.preferences.timeZone ?? browserTimeZone()
}

export function useSavePreferences() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (preferences: Preferences) => client.savePreferences(preferences),
    onSuccess: () => invalidate(workspaceKeys.preferences, workspaceKeys.insights),
  })
}

export function useCalendarQuery(from: string | null, to: string | null) {
  const client = useWorkspace()
  return useQuery({
    queryKey: workspaceKeys.calendarRange(from ?? '', to ?? ''),
    queryFn: () => client.listCalendar(from as string, to as string),
    enabled: from !== null && to !== null,
    placeholderData: (previous) => previous,
  })
}

function useCalendarChange<T>(mutationFn: (input: T) => Promise<unknown>) {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn, onSettled: () => invalidate(workspaceKeys.calendar, workspaceKeys.insights, workspaceKeys.effort) })
}

export function useDependenciesQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.dependencies, queryFn: () => client.listDependencies() })
}

export function useSetDependencies() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ taskId, dependsOn }: { taskId: string; dependsOn: string[] }) => client.setDependencies(taskId, dependsOn),
    onSettled: () => invalidate(workspaceKeys.dependencies),
  })
}

export function useEffortQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.effort, queryFn: () => client.efforts() })
}

export function useCreateEvent() {
  const client = useWorkspace()
  return useCalendarChange((input: CreateEventRequest) => client.createEvent(input))
}

export function useUpdateEvent() {
  const client = useWorkspace()
  return useCalendarChange(({ id, change }: { id: string; change: EventChange }) => client.updateEvent(id, change))
}

export function useDeleteEvent() {
  const client = useWorkspace()
  return useCalendarChange(({ id, scope, occurrenceStart }: { id: string; scope?: EditScope; occurrenceStart?: string | null }) =>
    client.deleteEvent(id, scope, occurrenceStart),
  )
}

export function useProposalsQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.proposals, queryFn: () => client.listProposals() })
}

export function useProposeSchedule() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (request: ScheduleRequest) => client.proposeSchedule(request),
    onSuccess: () => invalidate(workspaceKeys.proposals),
  })
}

/** Approving can change anything a proposal touches, so everything is refetched. */
export function useApplyProposal() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: ApplyProposalInput }) => client.applyProposal(id, input),
    onSettled: () =>
      invalidate(
        workspaceKeys.proposals,
        workspaceKeys.calendar,
        workspaceKeys.insights,
        workspaceKeys.dependencies,
        workspaceKeys.effort,
        queryKeys.projects,
        queryKeys.tasks,
        queryKeys.subtasks,
      ),
  })
}

export function useRejectProposal() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => client.rejectProposal(id),
    onSettled: () => invalidate(workspaceKeys.proposals),
  })
}

export function useInsightsQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.insights, queryFn: () => client.insights() })
}

export function useAiStatusQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.aiStatus, queryFn: () => client.aiStatus() })
}

export function useConversationsQuery() {
  const client = useWorkspace()
  return useQuery({ queryKey: workspaceKeys.conversations, queryFn: () => client.listConversations() })
}

export function useMessagesQuery(conversationId: string | null) {
  const client = useWorkspace()
  return useQuery({
    queryKey: workspaceKeys.messages(conversationId ?? ''),
    queryFn: () => client.conversationMessages(conversationId as string),
    enabled: conversationId !== null,
  })
}

export function useChat() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ message, conversationId }: { message: string; conversationId: string | null }) => client.chat(message, conversationId),
    onSettled: (response) =>
      invalidate(
        workspaceKeys.conversations,
        workspaceKeys.aiStatus,
        workspaceKeys.proposals,
        ...(response ? [workspaceKeys.messages(response.conversationId)] : []),
      ),
  })
}

export function useDeleteConversation() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => client.deleteConversation(id), onSettled: () => invalidate(workspaceKeys.conversations) })
}

export function useGeneratePlan() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (request: Partial<PlanRequest> & { goal: string }) => client.generatePlan(request),
    onSettled: () => invalidate(workspaceKeys.aiStatus, workspaceKeys.proposals),
  })
}

export function useAssistTask() {
  const client = useWorkspace()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ taskId, kind }: { taskId: string; kind: TaskAssistKind }) => client.assistTask(taskId, kind),
    onSettled: () => invalidate(workspaceKeys.aiStatus, workspaceKeys.proposals),
  })
}
