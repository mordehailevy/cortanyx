import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, PanelLeft, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Composer } from '../components/Composer'
import { EmptyState } from '../components/EmptyState'
import { MessageBubble } from '../components/MessageBubble'
import { Sidebar } from '../components/Sidebar'
import { useChat } from '../hooks/useChat'

export function ChatPage() {
  const chat = useChat()
  const reduce = useReducedMotion()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // follow the streaming answer, unless the user scrolled up to read
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottom) el.scrollTo({ top: el.scrollHeight })
  }, [chat.messages, atBottom])

  const startNew = () => {
    chat.newChat()
    setAtBottom(true)
    setDrawerOpen(false)
  }

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  const activeTitle = chat.conversations.find((c) => c.id === chat.conversationId)?.title ?? 'New conversation'

  const sidebar = (
    <Sidebar
      conversations={chat.conversations}
      loading={chat.historyLoading}
      activeId={chat.conversationId}
      onNew={startNew}
      onOpen={(id) => {
        void chat.openConversation(id)
        setAtBottom(true)
        setDrawerOpen(false)
      }}
      onRename={chat.renameConversation}
      onDelete={chat.deleteConversation}
    />
  )

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-72 shrink-0 border-e border-border bg-surface md:block">{sidebar}</aside>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Conversation history"
              className="fixed inset-y-0 start-0 z-50 w-[85%] max-w-xs border-e border-border bg-surface shadow-xl md:hidden"
              initial={reduce ? { opacity: 0 } : { x: '-100%' }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute end-2 top-3 grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-muted"
                aria-label="Close history"
              >
                <X className="size-5" />
              </button>
              <div className="h-full pt-12">{sidebar}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section className="relative flex min-w-0 flex-1 flex-col" aria-label="Chat">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Open conversation history"
          >
            <PanelLeft className="size-5" />
          </button>
          <h2 dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium">
            {activeTitle}
          </h2>
          <button
            type="button"
            onClick={startNew}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors duration-200 hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>New chat</span>
          </button>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin flex-1 overflow-y-auto">
          {chat.messages.length === 0 ? (
            <EmptyState onPick={chat.send} />
          ) : (
            <ol className="mx-auto flex max-w-3xl flex-col gap-5 px-3 py-6 sm:px-4" aria-live="polite">
              {chat.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </ol>
          )}
        </div>

        <AnimatePresence>
          {!atBottom && chat.messages.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
              className="absolute bottom-32 left-1/2 grid size-9 -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-border bg-background shadow-md"
              aria-label="Scroll to latest message"
            >
              <ArrowDown className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {chat.error && (
          <div
            role="alert"
            className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive sm:w-[calc(100%-2rem)]"
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
        )}

        <Composer
          onSend={chat.send}
          onStop={chat.stop}
          isStreaming={chat.isStreaming}
          focusKey={chat.conversationId}
        />
      </section>
    </div>
  )
}
