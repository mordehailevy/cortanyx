// All calls to the FastAPI backend. The browser never talks to OpenAI directly.

export type Role = 'user' | 'assistant'

export interface Message {
  id: number | string
  role: Role
  content: string
  created_at?: string
}

export interface Conversation {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
}

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function detailOf(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) return body.detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, '')).join(', ')
  } catch {
    /* not JSON */
  }
  // no JSON body on a 502/503/504: the dev proxy could not reach the API
  if (res.status >= 502 && res.status <= 504) return 'Cannot reach the server. Is the backend running?'
  return `Request failed (${res.status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }
  if (!res.ok) throw new ApiError(await detailOf(res), res.status)
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  createConversation: () => request<Conversation>('/api/conversations', { method: 'POST' }),
  listConversations: () => request<Conversation[]>('/api/conversations'),
  getConversation: (id: string) => request<ConversationDetail>(`/api/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    request<Conversation>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
}

export interface StreamHandlers {
  onUserMessage?: (m: Message) => void
  onDelta: (text: string) => void
  onDone: (m: Message) => void
  onTitle?: (title: string) => void
}

/** POST a message and read the Server-Sent Events answer chunk by chunk. */
export async function streamMessage(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }
  if (!res.ok || !res.body) throw new ApiError(await detailOf(res), res.status)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let event = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      if (!data) continue
      const payload = JSON.parse(data)
      switch (event) {
        case 'user_message':
          handlers.onUserMessage?.(payload)
          break
        case 'delta':
          handlers.onDelta(payload.text)
          break
        case 'done':
          handlers.onDone(payload)
          break
        case 'title':
          handlers.onTitle?.(payload.title)
          break
        case 'error':
          throw new ApiError(payload.detail, payload.status)
      }
    }
  }
}
