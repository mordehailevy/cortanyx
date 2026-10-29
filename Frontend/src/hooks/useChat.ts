import { useCallback, useEffect, useRef, useState } from 'react'
import { api, streamMessage, type Conversation, type Message } from '../lib/api'

export interface UiMessage extends Message {
  streaming?: boolean
}

let tempId = 0
const nextTempId = () => `tmp-${++tempId}`

/**
 * All chat state in one place: the current conversation, its messages,
 * the streaming answer and the history list shown in the sidebar.
 * Nothing is restored on page refresh: a refresh simply starts a new chat
 * (old conversations stay available in the history).
 */
export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<{ text: string; failedPrompt?: string } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(async () => {
    try {
      setConversations(await api.listConversations())
    } catch {
      /* the chat still works without the history list */
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

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || isStreaming) return
      setError(null)
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
      try {
        if (!cid) {
          const conv = await api.createConversation()
          cid = conv.id
          createdHere = true
          setConversationId(cid)
          setConversations((list) => [conv, ...list])
        }
        await streamMessage(
          cid,
          content,
          {
            onUserMessage: (saved) => {
              userId = saved.id
              setMessages((list) => list.map((m) => (m.id === userTmp ? { ...saved } : m)))
            },
            onDelta: (delta) => patchBot((m) => ({ ...m, content: m.content + delta })),
            onDone: (saved) => patchBot(() => ({ ...saved, streaming: false })),
            onTitle: (title) =>
              setConversations((list) => list.map((c) => (c.id === cid ? { ...c, title } : c))),
          },
          controller.signal,
        )
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          // "Stop" pressed: keep the partial answer (the server saved it too)
          setMessages((list) =>
            list
              .map((m) => (m.id === botTmp ? { ...m, streaming: false } : m))
              .filter((m) => !(m.id === botTmp && !m.content)),
          )
        } else {
          // the server rolled the user message back, so remove it here too
          setMessages((list) => list.filter((m) => m.id !== userId && m.id !== botTmp))
          setError({ text: (e as Error).message, failedPrompt: content })
          // don't leave an empty conversation in the history
          if (createdHere && cid) {
            await api.deleteConversation(cid).catch(() => {})
            setConversationId(null)
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

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    setConversationId(null)
    setMessages([])
    setError(null)
  }, [])

  const openConversation = useCallback(async (id: string) => {
    abortRef.current?.abort()
    setError(null)
    try {
      const detail = await api.getConversation(id)
      setConversationId(detail.id)
      setMessages(detail.messages)
    } catch (e) {
      setError({ text: (e as Error).message })
    }
  }, [])

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const updated = await api.renameConversation(id, title)
      setConversations((list) => list.map((c) => (c.id === id ? updated : c)))
    } catch (e) {
      setError({ text: (e as Error).message })
    }
  }, [])

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
    send,
    stop,
    newChat,
    openConversation,
    renameConversation,
    deleteConversation,
  }
}
