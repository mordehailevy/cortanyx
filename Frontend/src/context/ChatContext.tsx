import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ConfirmDeleteDialog, RenameDialog } from '../components/Dialogs'
import { useChat, type ChatState } from '../hooks/useChat'
import type { Conversation } from '../lib/api'

interface ContextValue extends ChatState {
  askRename: (c: Conversation) => void
  askDelete: (c: Conversation) => void
}

// One chat state for the whole app: the sidebar (always visible) and the
// pages read the same conversations, and a streaming answer survives navigation.
const ChatContext = createContext<ContextValue | null>(null)

// Actions that do not change while an answer streams, for memoized list items.
interface Actions {
  togglePin: (id: string) => void
  askRename: (c: Conversation) => void
  askDelete: (c: Conversation) => void
}
const ActionsContext = createContext<Actions | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChat()
  const [renaming, setRenaming] = useState<Conversation | null>(null)
  const [deleting, setDeleting] = useState<Conversation | null>(null)

  const value: ContextValue = { ...chat, askRename: setRenaming, askDelete: setDeleting }
  const { togglePin } = chat
  const actions = useMemo<Actions>(() => ({ togglePin, askRename: setRenaming, askDelete: setDeleting }), [togglePin])

  return (
    <ChatContext.Provider value={value}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
      <RenameDialog
        open={renaming !== null}
        title={renaming?.title ?? ''}
        onCancel={() => setRenaming(null)}
        onSave={(title) => {
          if (renaming) void chat.renameConversation(renaming.id, title)
          setRenaming(null)
        }}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={deleting?.title ?? ''}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void chat.deleteConversation(deleting.id)
          setDeleting(null)
        }}
      />
    </ChatContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatContext(): ContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used inside <ChatProvider>')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatActions(): Actions {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useChatActions must be used inside <ChatProvider>')
  return ctx
}
