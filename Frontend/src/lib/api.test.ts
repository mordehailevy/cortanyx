import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, streamMessage, type Message } from './api'

/** A fake fetch answering with a text/event-stream made of the given raw chunks. */
function mockStream(chunks: string[], init: ResponseInit = { status: 200 }) {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, init)))
}

function collect() {
  const seen = { user: [] as Message[], deltas: [] as string[], done: [] as Message[], titles: [] as string[] }
  return {
    seen,
    handlers: {
      onUserMessage: (m: Message) => seen.user.push(m),
      onDelta: (t: string) => seen.deltas.push(t),
      onDone: (m: Message) => seen.done.push(m),
      onTitle: (t: string) => seen.titles.push(t),
    },
  }
}

const run = (h: ReturnType<typeof collect>['handlers']) => streamMessage('c1', 'Hi', h, new AbortController().signal)
const user = { id: 1, role: 'user', content: 'Hi' }
const done = { id: 2, role: 'assistant', content: 'Hello you' }

afterEach(() => vi.unstubAllGlobals())

describe('streamMessage (SSE reader)', () => {
  it('reads every event in order', async () => {
    mockStream([
      `event: user_message\ndata: ${JSON.stringify(user)}\n\n`,
      'event: delta\ndata: {"text":"Hello "}\n\n',
      'event: delta\ndata: {"text":"you"}\n\n',
      `event: done\ndata: ${JSON.stringify(done)}\n\n`,
      'event: title\ndata: {"title":"Greeting"}\n\n',
    ])
    const { seen, handlers } = collect()
    await run(handlers)
    expect(seen.user[0].id).toBe(1)
    expect(seen.deltas.join('')).toBe('Hello you')
    expect(seen.done[0].content).toBe('Hello you')
    expect(seen.titles).toEqual(['Greeting'])
  })

  it('handles an event cut between two network chunks', async () => {
    mockStream(['event: delta\ndata: {"te', 'xt":"Hel', 'lo"}\n', '\n', `event: done\ndata: ${JSON.stringify(done)}\n\n`])
    const { seen, handlers } = collect()
    await run(handlers)
    expect(seen.deltas).toEqual(['Hello'])
  })

  it('accepts \\r\\n line endings, "data:" without a space and multi-line data', async () => {
    mockStream([
      'event: delta\r\ndata:{"text":"a"}\r\n\r\n',
      'event: delta\ndata: {"text":\ndata: "b"}\n\n',
      `event: done\r\ndata: ${JSON.stringify(done)}\r\n\r\n`,
    ])
    const { seen, handlers } = collect()
    await run(handlers)
    expect(seen.deltas).toEqual(['a', 'b'])
    expect(seen.done).toHaveLength(1)
  })

  it('skips a malformed event instead of failing the answer', async () => {
    mockStream(['event: delta\ndata: {not json\n\n', 'event: delta\ndata: {"text":"ok"}\n\n', `event: done\ndata: ${JSON.stringify(done)}\n\n`])
    const { seen, handlers } = collect()
    await run(handlers)
    expect(seen.deltas).toEqual(['ok'])
  })

  it('reports a stream that ends without "done" as an interrupted connection', async () => {
    mockStream(['event: delta\ndata: {"text":"Hel"}\n\n'])
    const { handlers } = collect()
    await expect(run(handlers)).rejects.toThrow('interrupted')
  })

  it('turns an "error" event into an ApiError with its status', async () => {
    mockStream(['event: error\ndata: {"detail":"quota","status":429}\n\n'])
    const { handlers } = collect()
    const err = await run(handlers).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(429)
    expect(err.message).toBe('quota')
  })

  it('ignores an "error" event that arrives after "done" (the answer is already saved)', async () => {
    mockStream([`event: done\ndata: ${JSON.stringify(done)}\n\n`, 'event: error\ndata: {"detail":"late","status":500}\n\n'])
    const { seen, handlers } = collect()
    await run(handlers)
    expect(seen.done).toHaveLength(1)
  })

  it('reads the error detail of a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Conversation not found' }), { status: 404 })))
    const { handlers } = collect()
    await expect(run(handlers)).rejects.toMatchObject({ status: 404, message: 'Conversation not found' })
  })

  it('explains a 502 from the dev proxy as an unreachable backend', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad Gateway', { status: 502 })))
    const { handlers } = collect()
    await expect(run(handlers)).rejects.toThrow('Cannot reach the server')
  })
})
