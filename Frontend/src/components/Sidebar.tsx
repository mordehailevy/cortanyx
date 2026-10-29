import { Check, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Conversation } from '../lib/api'

interface Props {
  conversations: Conversation[]
  loading: boolean
  activeId: string | null
  onNew: () => void
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function groupLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  return 'Older'
}

export function Sidebar({ conversations, loading, activeId, onNew, onOpen, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const groups = conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
    ;(acc[groupLabel(c.updated_at)] ??= []).push(c)
    return acc
  }, {})

  const commitRename = (id: string) => {
    const t = draft.trim()
    if (t) onRename(id, t)
    setEditing(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="size-4" aria-hidden="true" />
          New conversation
        </button>
      </div>

      <nav aria-label="Conversation history" className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {loading && (
          <ul className="space-y-2 px-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-8 animate-pulse rounded-lg bg-muted" />
            ))}
          </ul>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Your conversations will appear here.</p>
        )}
        {Object.entries(groups).map(([label, items]) => (
          <section key={label} className="mt-3">
            <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
            <ul className="space-y-0.5">
              {items.map((c) => {
                const active = c.id === activeId
                if (editing === c.id) {
                  return (
                    <li key={c.id} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                      <input
                        autoFocus
                        dir="auto"
                        value={draft}
                        maxLength={120}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(c.id)
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
                        aria-label="New title"
                      />
                      <IconBtn label="Save title" onClick={() => commitRename(c.id)}>
                        <Check className="size-4" />
                      </IconBtn>
                      <IconBtn label="Cancel" onClick={() => setEditing(null)}>
                        <X className="size-4" />
                      </IconBtn>
                    </li>
                  )
                }
                if (confirming === c.id) {
                  return (
                    <li key={c.id} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm">
                      <span className="flex-1 text-destructive">Delete?</span>
                      <IconBtn
                        label="Confirm delete"
                        onClick={() => {
                          onDelete(c.id)
                          setConfirming(null)
                        }}
                      >
                        <Check className="size-4 text-destructive" />
                      </IconBtn>
                      <IconBtn label="Cancel" onClick={() => setConfirming(null)}>
                        <X className="size-4" />
                      </IconBtn>
                    </li>
                  )
                }
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 pe-16 text-start text-sm transition-colors duration-200 ${
                        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
                      <span dir="auto" className="truncate">
                        {c.title}
                      </span>
                    </button>
                    <div className="absolute inset-y-0 end-1 flex items-center gap-0.5 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      <IconBtn
                        label={`Rename ${c.title}`}
                        onClick={() => {
                          setDraft(c.title)
                          setEditing(c.id)
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </IconBtn>
                      <IconBtn label={`Delete ${c.title}`} onClick={() => setConfirming(c.id)}>
                        <Trash2 className="size-3.5" />
                      </IconBtn>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-background hover:text-foreground"
    >
      {children}
    </button>
  )
}
