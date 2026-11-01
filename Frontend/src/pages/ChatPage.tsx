import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ChevronDown, Pencil, Pin, PinOff, RotateCcw, Trash2, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Composer } from '../components/Composer'
import { EmptyState } from '../components/EmptyState'
import { Menu } from '../components/Menu'
import { MessageBubble } from '../components/MessageBubble'
import { useChatContext } from '../context/ChatContext'
import { langOf } from '../lib/text'

export function ChatPage() {
  const chat = useChatContext()
  const reduce = useReducedMotion()
  const { id } = useParams()
  const navigate = useNavigate()
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The URL is the source of truth.
  // URL -> state: /chat/:id opens that conversation (even during an answer: it is
  // stopped and its partial text kept); "/" shows a new empty chat (Back button).
  useEffect(() => {
    if (!id) {
      if (chat.conversationId) chat.newChat(true)
      return
    }
    if (id === chat.conversationId) return
    void chat.openConversation(id).then((ok) => {
      if (!ok) navigate('/', { replace: true })
      setAtBottom(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // state -> URL: a new chat gets its own address after its first message, and a
  // conversation that disappears (deleted, or its first message failed) goes home
  const previousConversation = useRef(chat.conversationId)
  useEffect(() => {
    const before = previousConversation.current
    previousConversation.current = chat.conversationId
    if (chat.conversationId && id !== chat.conversationId && !chat.loadingConversation) {
      navigate(`/chat/${chat.conversationId}`, { replace: !id })
    } else if (before && !chat.conversationId && id) {
      navigate('/', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.conversationId])

  // sending always brings the conversation back to the bottom
  useEffect(() => {
    if (chat.sendCount) setAtBottom(true)
  }, [chat.sendCount])

  // follow the streaming answer, unless the user scrolled up to read
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottom) el.scrollTo({ top: el.scrollHeight })
  }, [chat.messages, atBottom])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  const current = chat.conversations.find((c) => c.id === chat.conversationId)
  const lastIndex = chat.messages.length - 1
  // a /chat/:id link not loaded yet (first render after a reload): no flash of the new-chat screen
  const loading = chat.loadingConversation || (!!id && id !== chat.conversationId)
  const empty = chat.messages.length === 0 && !loading

  const errorBanner = chat.error && (
    <div
      role="alert"
      className="mx-auto mb-2 flex w-[calc(100%-1.5rem)] max-w-3xl items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{chat.error.text}</span>
      {chat.error.failedPrompt && (
        <button
          type="button"
          onClick={() => void chat.send(chat.error!.failedPrompt!)}
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-destructive/10"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" /> Retry
        </button>
      )}
      <button
        type="button"
        onClick={chat.dismissError}
        className="grid size-7 cursor-pointer place-items-center rounded-md hover:bg-destructive/10"
        aria-label="Dismiss error"
      >
        <X className="size-4" />
      </button>
    </div>
  )

  const composer = (
    <Composer
      key={chat.draft?.n ?? 0}
      initialValue={chat.draft?.text ?? ''}
      onSend={chat.send}
      onStop={chat.stop}
      isStreaming={chat.isStreaming}
      focusKey={chat.conversationId}
    />
  )

  return (
    <section className="relative flex h-full min-w-0 flex-col" aria-label="Chat">
      {/* Desktop conversation header: title with a menu, like Claude */}
      <div className="hidden h-12 shrink-0 items-center justify-center px-4 md:flex">
        {current ? (
          <Menu
            align="start"
            label={`Options for ${current.title}`}
            items={[
              {
                label: current.pinned ? 'Unpin' : 'Pin',
                icon: current.pinned ? <PinOff /> : <Pin />,
                onSelect: () => chat.togglePin(current.id),
              },
              { label: 'Rename', icon: <Pencil />, onSelect: () => chat.askRename(current) },
              { label: 'Delete', icon: <Trash2 />, onSelect: () => chat.askDelete(current), danger: true },
            ]}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="flex max-w-md cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-muted"
                aria-label={`Conversation options: ${current.title}`}
              >
                {current.pinned && <Pin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                <span dir="auto" lang={langOf(current.title)} className="truncate">
                  {current.title}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            )}
          />
        ) : null}
      </div>
      {current && <h1 className="sr-only">{current.title}</h1>}

      {empty ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <EmptyState onPick={chat.send} composer={composer} errorBanner={errorBanner} />
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto">
            {loading ? (
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-8" aria-label="Loading conversation" role="status">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-14 animate-pulse rounded-2xl bg-muted ${i % 2 ? 'w-2/3' : 'ms-auto w-1/2'}`} />
                ))}
              </div>
            ) : (
              <ol className="thread mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6" aria-live="polite">
                {chat.messages.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onRegenerate={i === lastIndex && !chat.isStreaming ? chat.regenerate : undefined}
                  />
                ))}
              </ol>
            )}
          </div>

          <AnimatePresence>
            {!atBottom && (
              <motion.button
                type="button"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                onClick={() =>
                  scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
                }
                className="absolute bottom-36 left-1/2 grid size-9 -translate-x-1/2 max-md:size-11 cursor-pointer place-items-center rounded-full border border-border bg-background shadow-md"
                aria-label="Scroll to latest message"
              >
                <ArrowDown className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {errorBanner}
          {composer}
        </>
      )}
    </section>
  )
}
