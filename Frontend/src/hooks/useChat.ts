import { useCallback, useEffect, useRef, useState } from 'react'
import { api, streamMessage, streamRegenerate, type Conversation, type Message, type StreamHandlers } from '../lib/api'

export interface UiMessage extends Message {
  streaming?: boolean
  /** the user pressed Stop during this answer */
  stopped?: boolean
}

let tempId = 0
const nextTempId = () => `tmp-${++tempId}`

const isAbort = (e: unknown) => (e as Error).name === 'AbortError'

/**
 * All chat state in one place: the current conversation, its messages,
 * the streaming answer and the conversation list shown in the sidebar.
 * Each conversation has its own URL (/chat/:id), so a reload reopens it;
 * the database always matches what is on screen.
 */
export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<{ text: string; failedPrompt?: string } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [loadingConversation, setLoadingConversation] = useState(false)
  /** bumped on every send so the page can scroll to the bottom */
  const [sendCount, setSendCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  /** the conversation on screen right now: a late error from another one must not touch the screen */
  const activeRef = useRef<string | null>(null)
  /** conversations deleted here because their first message failed: never reopen them by URL */
  const discardedRef = useRef(new Set<string>())
  /** text given back to the input when a message was cancelled before any answer */
  const [draft, setDraft] = useState<{ text: string; n: number } | null>(null)

  const refreshHistory = useCallback(async () => {
    try {
      setConversations(await api.listConversations())
    } catch {
      /* the chat still works without the conversation list */
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    api
      .listConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  /**
   * After a Stop the server may have saved a few more words than were displayed:
   * reload the conversation so the screen shows exactly what is stored.
   */
  const syncFromServer = (cid: string) => {
    window.setTimeout(() => {
      api
        .getConversation(cid)
        .then((detail) => {
          if (activeRef.current === cid && !abortRef.current) setMessages(detail.messages)
        })
        .catch(() => {})
    }, 600)
  }

  const setTitle = (cid: string, title: string) =>
    setConversations((list) => list.map((c) => (c.id === cid ? { ...c, title } : c)))

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || isStreaming) return
      setError(null)
      setDraft(consumeDraft)
      setSendCount((n) => n + 1)
      const userTmp = nextTempId()
      const botTmp = nextTempId()
      let userId: Message['id'] = userTmp
      setMessages((m) => [
        ...m,
        { id: userTmp, role: 'user', content },
        { id: botTmp, role: 'assistant', content: '', streaming: true },
      ])
      setIsStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      const patchBot = (fn: (m: UiMessage) => UiMessage) =>
        setMessages((list) => list.map((m) => (m.id === botTmp ? fn(m) : m)))

      let cid = conversationId
      let createdHere = false
      let gotText = false
      try {
        if (!cid) {
          const conv = await api.createConversation()
          cid = conv.id
          createdHere = true
          activeRef.current = cid
          setConversationId(cid)
          setConversations((list) => sortConversations([conv, ...list]))
        }
        const target = cid
        await streamMessage(
          target,
          content,
          {
            onUserMessage: (saved) => {
              userId = saved.id
              setMessages((list) => list.map((m) => (m.id === userTmp ? { ...saved } : m)))
            },
            onDelta: (delta) => {
              gotText = true
              patchBot((m) => ({ ...m, content: m.content + delta }))
            },
            onDone: (saved) => patchBot(() => ({ ...saved, streaming: false })),
            onTitle: (title) => setTitle(target, title),
          },
          controller.signal,
        )
      } catch (e) {
        const stillOnScreen = activeRef.current === cid
        if (isAbort(e) && gotText) {
          // Stop mid-answer: the server kept the partial answer too
          if (stillOnScreen) {
            patchBot((m) => ({ ...m, streaming: false, stopped: true }))
            if (cid) syncFromServer(cid)
          }
        } else {
          // nothing was answered: the server removed the user message
          if (createdHere && cid) {
            discardedRef.current.add(cid)
            await api.deleteConversation(cid).catch(() => {}) // no empty conversation left
          }
          if (stillOnScreen) {
            setMessages((list) => list.filter((m) => m.id !== userId && m.id !== botTmp))
            setDraft((d) => ({ text: content, n: (d?.n ?? 0) + 1 })) // give the text back
            if (!isAbort(e)) setError({ text: (e as Error).message, failedPrompt: content })
            if (createdHere) {
              activeRef.current = null
              setConversationId(null)
            }
          }
        }
      } finally {
        abortRef.current = null
        setIsStreaming(false)
        void refreshHistory()
      }
    },
    [conversationId, isStreaming, refreshHistory],
  )

  /** Replace the last answer with a new one (after a Stop, a cut, or just to try again). */
  const regenerate = useCallback(async () => {
    const cid = conversationId
    if (!cid || isStreaming) return
    const last = messages[messages.length - 1]
    const previous = last?.role === 'assistant' ? last : null
    setError(null)
    setSendCount((n) => n + 1)
    const botTmp = nextTempId()
    setMessages((list) => [
      ...(previous ? list.slice(0, -1) : list),
      { id: botTmp, role: 'assistant', content: '', streaming: true },
    ])
    setIsStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    const patchBot = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((list) => list.map((m) => (m.id === botTmp ? fn(m) : m)))
    let gotText = false
    const handlers: StreamHandlers = {
      onDelta: (delta) => {
        gotText = true
        patchBot((m) => ({ ...m, content: m.content + delta }))
      },
      onDone: (saved) => patchBot(() => ({ ...saved, streaming: false })),
      onTitle: (title) => setTitle(cid, title),
    }
    try {
      await streamRegenerate(cid, handlers, controller.signal)
    } catch (e) {
      if (activeRef.current !== cid) {
        // the user opened another conversation meanwhile: nothing to update on screen
      } else if (isAbort(e) && gotText) {
        patchBot((m) => ({ ...m, streaming: false, stopped: true }))
        syncFromServer(cid)
      } else {
        // the server kept the previous answer: show it again
        setMessages((list) => list.flatMap((m) => (m.id === botTmp ? (previous ? [previous] : []) : [m])))
        if (!isAbort(e)) setError({ text: (e as Error).message })
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
      void refreshHistory()
    }
  }, [conversationId, isStreaming, messages, refreshHistory])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  /** keepError: keep a message such as "Conversation not found." visible on the new chat */
  const newChat = useCallback((keepError = false) => {
    abortRef.current?.abort()
    activeRef.current = null
    setConversationId(null)
    setMessages([])
    setDraft(consumeDraft)
    if (!keepError) setError(null)
  }, [])

  /** Loads a conversation; returns false when it does not exist (bad or deleted link). */
  const openConversation = useCallback(async (id: string): Promise<boolean> => {
    // its first message failed and it was deleted on purpose: go home, keep the real error
    if (discardedRef.current.has(id)) return false
    abortRef.current?.abort()
    activeRef.current = id
    setDraft(consumeDraft)
    setError(null)
    setLoadingConversation(true)
    try {
      const detail = await api.getConversation(id)
      setConversationId(detail.id)
      setMessages(detail.messages)
      return true
    } catch (e) {
      setError({ text: (e as { status?: number }).status === 404 ? 'Conversation not found.' : (e as Error).message })
      return false
    } finally {
      setLoadingConversation(false)
    }
  }, [])

  const updateConversation = useCallback(async (id: string, changes: { title?: string; pinned?: boolean }) => {
    try {
      const updated = await api.updateConversation(id, changes)
      setConversations((list) => sortConversations(list.map((c) => (c.id === id ? updated : c))))
    } catch (e) {
      setError({ text: (e as Error).message })
    }
  }, [])

  const renameConversation = useCallback(
    (id: string, title: string) => updateConversation(id, { title }),
    [updateConversation],
  )

  const togglePin = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id)
      if (conv) void updateConversation(id, { pinned: !conv.pinned })
    },
    [conversations, updateConversation],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id)
        setConversations((list) => list.filter((c) => c.id !== id))
        if (id === conversationId) newChat()
      } catch (e) {
        setError({ text: (e as Error).message })
      }
    },
    [conversationId, newChat],
  )

  return {
    conversationId,
    messages,
    isStreaming,
    error,
    dismissError: () => setError(null),
    conversations,
    historyLoading,
    sendCount,
    draft,
    send,
    regenerate,
    stop,
    newChat,
    openConversation,
    loadingConversation,
    renameConversation,
    togglePin,
    deleteConversation,
  }
}

export type ChatState = ReturnType<typeof useChat>

/** A given-back text fills the input once; afterwards the input starts empty again. */
const consumeDraft = (d: { text: string; n: number } | null) => (d && d.text ? { text: '', n: d.n } : d)

/** Pinned first, then most recent activity (same order as the API). */
function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
  )
}
