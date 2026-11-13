import type {
  AssistantContextInput,
  AssistantTurn,
  IsoDate,
  PlanRequest,
  ProjectPlan,
  TaskAssistKind,
  TaskAssistResult,
  UseCase,
} from '../../src/domain'

/*
  The AI provider abstraction (M9). The rest of the server only knows this interface, so the
  provider can change (mock → Claude → another vendor) without touching features or tests.

  Every implementation must return output that already passed the domain's Zod schemas; the
  service validates it again anyway. Providers never see user ids, emails or other users' data.
*/

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantRequest {
  /** The bounded, fenced data block (buildAssistantContext). */
  contextText: string
  history: ChatMessage[]
  message: string
  useCase: UseCase
  /** Structured data behind contextText. Only the offline mock reads it; real providers get the text. */
  data: AssistantContextInput
}

export interface PlanProviderRequest {
  request: PlanRequest
  today: IsoDate
  useCase: UseCase
}

export interface TaskAssistRequest {
  kind: TaskAssistKind
  today: IsoDate
  useCase: UseCase
  task: {
    title: string
    description: string
    status: string
    priority: string
    dueDate: string | null
    estimatedMinutes: number | null
    projectName: string
    subtasks: string[]
  }
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface ProviderResult<T> {
  output: T
  usage: Usage
}

/** Which request a call is (for limits and usage logs). */
export type AiRequestKind = 'assistant' | 'plan' | 'assist'

export interface AiProvider {
  /** 'mock' answers are demo output and are labelled as such everywhere. */
  readonly name: 'mock' | 'anthropic'
  readonly model: string | null
  assistantTurn(request: AssistantRequest): Promise<ProviderResult<AssistantTurn>>
  projectPlan(request: PlanProviderRequest): Promise<ProviderResult<ProjectPlan>>
  taskAssist(request: TaskAssistRequest): Promise<ProviderResult<TaskAssistResult>>
}

export type AiErrorCode = 'unavailable' | 'timeout' | 'rate_limited' | 'invalid_output' | 'refused'

/** A provider failure, with a code the API turns into a safe, friendly message. */
export class AiError extends Error {
  readonly code: AiErrorCode
  /** Token usage when the provider did answer (e.g. refused or invalid output): it was billed. */
  readonly usage: Usage | null

  constructor(code: AiErrorCode, message: string, options?: ErrorOptions & { usage?: Usage }) {
    super(message, options)
    this.name = 'AiError'
    this.code = code
    this.usage = options?.usage ?? null
  }
}
