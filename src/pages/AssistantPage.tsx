import { MessageSquarePlus, Send, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ProposalCard } from '../components/workspace/ProposalCard'
import { SourceBadge } from '../components/workspace/SourceBadge'
import { Button } from '../components/ui/Button'
import { controlClass } from '../components/ui/styles'
import { AI_LIMITS, type Proposal } from '../domain'
import { useToast } from '../hooks/toast'
import { useAiStatusQuery, useChat, useConversationsQuery, useDeleteConversation, useMessagesQuery, useProposalsQuery } from '../hooks/workspaceQueries'
import { errorMessage } from '../lib/format'

const SUGGESTIONS = ['What is due this week?', 'What should I focus on today?', 'Schedule my week', 'How am I doing?']

/**
 * The AI assistant: questions about your own tasks and calendar, and suggestions that become
 * proposals. Nothing is changed without approving a proposal.
 */
export function AssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationId = searchParams.get('c')
  const [draft, setDraft] = useState('')
  const [planGoal, setPlanGoal] = useState<string | null>(null)
  // Proposals returned in this session, so they render even after they're decided.
  const [proposals, setProposals] = useState<Record<string, Proposal>>({})
  const status = useAiStatusQuery()
  const conversations = useConversationsQuery()
  const messages = useMessagesQuery(conversationId)
  const pending = useProposalsQuery()
  const chat = useChat()
  const deleteConversation = useDeleteConversation()
  const showToast = useToast()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.data?.length, chat.isPending])

  const proposalFor = (id: string | null) => (id ? (proposals[id] ?? pending.data?.find((proposal) => proposal.id === id)) : undefined)

  async function send(message: string) {
    const text = message.trim()
    if (!text || chat.isPending) return
    setPlanGoal(null)
    try {
      const response = await chat.mutateAsync({ message: text, conversationId })
      setDraft('')
      if (response.proposal) setProposals((current) => ({ ...current, [response.proposal!.id]: response.proposal! }))
      setPlanGoal(response.planGoal)
      if (response.conversationId !== conversationId) setSearchParams({ c: response.conversationId })
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void send(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send(draft)
    }
  }

  return (
    <div className="space-y-6">
      <title>AI Assistant · AI Task Manager</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-h2 font-semibold text-ink">
            AI Assistant {status.data && <SourceBadge source={status.data.provider} />}
          </h1>
          <p className="mt-1 text-ink-muted">Ask about your tasks and calendar. Suggested changes wait for your approval.</p>
        </div>
        <Link to="/app/assistant/plan" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-glow px-5 text-sm font-semibold text-night hover:bg-glow-strong">
          <Wand2 aria-hidden="true" className="size-4" /> Plan a new goal
        </Link>
      </div>

      {status.data?.isDemo && (
        <p className="rounded-control border border-priority-medium/50 p-3 text-sm text-ink">
          Demo mode: answers come from built-in rules over your real data, not from a language model. No AI service is connected.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Conversations" className="space-y-2">
          <Button className="w-full" onClick={() => setSearchParams({})}>
            <MessageSquarePlus aria-hidden="true" className="size-4" /> New conversation
          </Button>
          <ul className="space-y-1">
            {(conversations.data ?? []).map((conversation) => (
              <li key={conversation.id} className="flex items-center gap-1">
                <Link
                  to={`/app/assistant?c=${conversation.id}`}
                  aria-current={conversation.id === conversationId ? 'page' : undefined}
                  className={`min-h-11 min-w-0 flex-1 truncate rounded-control px-3 py-3 text-sm ${conversation.id === conversationId ? 'bg-raised text-ink' : 'text-ink-muted hover:bg-raised hover:text-ink'}`}
                >
                  {conversation.title}
                </Link>
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={`Delete conversation "${conversation.title}"`}
                  onClick={async () => {
                    await deleteConversation.mutateAsync(conversation.id)
                    if (conversation.id === conversationId) setSearchParams({})
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label="Conversation" className="flex min-h-96 flex-col rounded-card border border-line bg-surface">
          <div aria-live="polite" className="flex-1 space-y-4 p-4 sm:p-5">
            {!conversationId && (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted">Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button key={suggestion} onClick={() => void send(suggestion)} disabled={chat.isPending}>
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {(messages.data ?? []).map((message) => {
              const proposal = proposalFor(message.proposalId)
              return (
                <article key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[85%]' : 'max-w-[95%]'}>
                  <h3 className="sr-only">{message.role === 'user' ? 'You' : 'Assistant'}</h3>
                  <div className={`rounded-card p-3 text-sm ${message.role === 'user' ? 'bg-glow-deep text-ink' : 'border border-line bg-raised text-ink'}`}>
                    {message.role === 'assistant' && (
                      <div className="mb-1">
                        <SourceBadge source={message.source} />
                      </div>
                    )}
                    {/* Plain text only: AI output is never rendered as HTML. */}
                    <p className="whitespace-pre-line">{message.content}</p>
                  </div>
                  {proposal && (
                    <div className="mt-2">
                      <ProposalCard proposal={proposal} onDecided={(decided) => setProposals((current) => ({ ...current, [decided.id]: decided }))} />
                    </div>
                  )}
                  {message.proposalId && !proposal && <p className="mt-1 text-xs text-ink-subtle">A suggestion was attached (already decided or expired).</p>}
                </article>
              )
            })}
            {chat.isPending && <output className="block text-sm text-ink-muted">Thinking…</output>}
            {planGoal && (
              <div className="rounded-card border border-glow/40 p-3 text-sm">
                <Link to={`/app/assistant/plan?goal=${encodeURIComponent(planGoal)}`} className="font-medium text-glow underline-offset-4 hover:underline">
                  Open the plan builder for this goal
                </Link>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-line p-3 sm:p-4">
            <label htmlFor="assistant-message" className="sr-only">
              Message
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="assistant-message"
                rows={2}
                maxLength={AI_LIMITS.message}
                placeholder="Ask about your tasks, or describe what you want to change…"
                className={`${controlClass} py-2`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                aria-describedby="assistant-hint"
              />
              <Button type="submit" variant="primary" iconOnly aria-label="Send" disabled={chat.isPending || !draft.trim()}>
                <Send aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <p id="assistant-hint" className="mt-1 text-xs text-ink-subtle">
              Enter to send, Shift+Enter for a new line · {draft.length}/{AI_LIMITS.message}
              {status.data && ` · ${status.data.usedToday}/${status.data.dailyLimit} AI requests today`}
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
