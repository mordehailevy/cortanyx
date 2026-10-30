import {
  ArrowDown,
  ArrowUp,
  Info,
  MessageSquare,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { Fragment, memo, useCallback, useState, type DragEvent, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useChatActions, useChatContext } from '../context/ChatContext'
import { useTheme } from '../hooks/useTheme'
import type { Conversation } from '../lib/api'
import { LogoMark } from './Logo'
import { Menu } from './Menu'
import { langOf } from '../lib/text'

interface Props {
  collapsed: boolean
  onToggleCollapsed: () => void
  /** mobile drawer: called after a navigation so the drawer closes */
  onNavigate?: () => void
  mobile?: boolean
}

const iconBtn =
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground max-md:size-11'

export function AppSidebar({ collapsed, onToggleCollapsed, onNavigate, mobile = false }: Props) {
  const chat = useChatContext()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  // drag and drop: the conversation being dragged and where it would land
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ section: SectionKind; index: number } | null>(null)
  const { placeConversation } = useChatActions()
  const endDrag = useCallback(() => {
    setDragId(null)
    setDrop(null)
  }, [])
  const dropHere = () => {
    if (dragId && drop) {
      if (drop.section === 'recents') {
        placeConversation(dragId, null)
      } else {
        // the list still contains the dragged item: moving it down shifts the target by one
        const from = pinned.findIndex((c) => c.id === dragId)
        placeConversation(dragId, from !== -1 && from < drop.index ? drop.index - 1 : drop.index)
      }
    }
    endDrag()
  }

  const go = (to: string) => {
    navigate(to)
    onNavigate?.()
  }
  const startNew = () => {
    chat.newChat()
    go('/')
  }

  const q = query.trim().toLowerCase()
  const visible = q ? chat.conversations.filter((c) => c.title.toLowerCase().includes(q)) : chat.conversations
  const pinned = visible.filter((c) => c.pinned)
  const recents = visible.filter((c) => !c.pinned)
  const dnd = { dragId, dragPinned: pinned.some((c) => c.id === dragId), drop, setDragId, setDrop, dropHere, endDrag }

  if (collapsed && !mobile) {
    // Icon rail, like Claude's collapsed sidebar
    return (
      <nav aria-label="Main menu" className="flex h-full w-14 flex-col items-center gap-1 py-3">
        <button type="button" onClick={onToggleCollapsed} className={iconBtn} aria-label="Expand sidebar" title="Expand sidebar">
          <PanelLeftOpen className="size-5" />
        </button>
        <button
          type="button"
          onClick={startNew}
          className="mt-2 grid size-9 cursor-pointer place-items-center rounded-full bg-primary text-on-primary transition-transform duration-150 hover:scale-105"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="size-5" />
        </button>
        <RailLink to="/" label="Chat" icon={<MessageSquare className="size-5" />} />
        <RailLink to="/about" label="About" icon={<Info className="size-5" />} />
        <div className="mt-auto flex flex-col items-center gap-1">
          <button type="button" onClick={toggle} className={iconBtn} aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <Avatar />
        </div>
      </nav>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <NavLink to="/" onClick={() => onNavigate?.()} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg max-md:min-h-11" aria-label="Cortanyx home">
          <LogoMark className="size-7" />
          <span className="truncate text-[17px] font-semibold tracking-tight">Cortanyx</span>
        </NavLink>
        {!mobile && (
          <button type="button" onClick={onToggleCollapsed} className={iconBtn} aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeftClose className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Main menu" className="space-y-0.5 px-2">
        <button
          type="button"
          onClick={startNew}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted max-md:min-h-11"
        >
          <span className="grid size-7 place-items-center rounded-full bg-primary text-on-primary transition-transform duration-150 group-hover:scale-105">
            <Plus className="size-4" aria-hidden="true" />
          </span>
          New chat
        </button>
        <button
          type="button"
          onClick={() => setSearching((s) => !s)}
          aria-expanded={searching}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground max-md:min-h-11"
        >
          <span className="grid size-7 place-items-center">
            <Search className="size-[18px]" aria-hidden="true" />
          </span>
          Search chats
        </button>
        <SideLink to="/" label="Chat" icon={<MessageSquare className="size-[18px]" />} onNavigate={onNavigate} />
        <SideLink to="/about" label="About" icon={<Info className="size-[18px]" />} onNavigate={onNavigate} />
      </nav>

      {searching && (
        <div className="relative mx-3 mt-2">
          <label htmlFor="chat-search" className="sr-only">
            Search conversation titles
          </label>
          <input
            id="chat-search"
            autoFocus
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('')
                setSearching(false)
              }
            }}
            placeholder="Search titles…"
            className="w-full rounded-lg border border-input bg-background py-2 ps-3 pe-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 max-md:min-h-11"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 end-1 my-auto grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {chat.historyLoading && (
          <ul className="space-y-2 px-2" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="h-7 animate-pulse rounded-lg bg-muted" />
            ))}
          </ul>
        )}
        {!chat.historyLoading && visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {q ? 'No conversation matches your search.' : 'Your conversations will appear here.'}
          </p>
        )}
        {(pinned.length > 0 || (dragId && !q)) && (
          <Section kind="pinned" title="Pinned" items={pinned} onNavigate={onNavigate} mobile={mobile} dnd={dnd} />
        )}
        {recents.length > 0 && (
          <Section kind="recents" title="Recents" items={recents} onNavigate={onNavigate} mobile={mobile} dnd={dnd} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
        <Avatar />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">Mordehai Levy</p>
          <p className="truncate text-xs text-muted-foreground">Full Stack · Final project</p>
        </div>
        <button type="button" onClick={toggle} className={iconBtn} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
      </div>
    </div>
  )
}

type SectionKind = 'pinned' | 'recents'

interface Dnd {
  dragId: string | null
  /** the dragged conversation is pinned (so dropping it on Recents unpins it) */
  dragPinned: boolean
  drop: { section: SectionKind; index: number } | null
  setDragId: (id: string | null) => void
  setDrop: (drop: { section: SectionKind; index: number } | null) => void
  dropHere: () => void
  endDrag: () => void
}

function Section({
  kind,
  title,
  items,
  onNavigate,
  mobile,
  dnd,
}: {
  kind: SectionKind
  title: string
  items: Conversation[]
  onNavigate?: () => void
  mobile: boolean
  dnd: Dnd
}) {
  const activeId = useChatContext().conversationId
  const target = dnd.drop?.section === kind ? dnd.drop.index : null

  // where would the dragged conversation land? (above or below the hovered item)
  const onDragOver = (e: DragEvent<HTMLElement>) => {
    if (!dnd.dragId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]')
    let index = items.length
    if (li) {
      const i = items.findIndex((c) => c.id === li.dataset.id)
      const box = li.getBoundingClientRect()
      index = e.clientY < box.top + box.height / 2 ? i : i + 1
    }
    if (dnd.drop?.section !== kind || dnd.drop.index !== index) dnd.setDrop({ section: kind, index })
  }

  // Recents is a drop target only for a pinned conversation (dropping there unpins it)
  const highlightRecents = kind === 'recents' && target !== null && dnd.dragPinned

  return (
    <section
      className={`mb-4 rounded-lg transition-colors duration-150 ${highlightRecents ? 'bg-primary/5 ring-1 ring-primary/40' : ''}`}
      aria-labelledby={`section-${title}`}
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault()
        dnd.dropHere()
      }}
    >
      <h2 id={`section-${title}`} className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        {title}
      </h2>
      {kind === 'pinned' && items.length === 0 ? (
        <p
          className={`mx-2 rounded-lg border border-dashed px-3 py-3 text-center text-xs transition-colors duration-150 ${
            target !== null ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
          }`}
        >
          Drop here to pin
        </p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((c, i) => (
            <Fragment key={c.id}>
              {kind === 'pinned' && target === i && <DropLine />}
              <ConversationItem
                conversation={c}
                onNavigate={onNavigate}
                mobile={mobile}
                active={c.id === activeId}
                dragging={c.id === dnd.dragId}
                onDragStart={dnd.setDragId}
                onDragEnd={dnd.endDrag}
                position={kind === 'pinned' ? { index: i, count: items.length } : undefined}
              />
            </Fragment>
          ))}
          {kind === 'pinned' && target === items.length && <DropLine />}
        </ul>
      )}
    </section>
  )
}

/** Where a dragged conversation will be inserted. */
function DropLine() {
  return <li aria-hidden="true" className="mx-2 h-0.5 rounded-full bg-primary" />
}

// Memoized with stable actions: the list does not re-render for every streamed word.
const ConversationItem = memo(function ConversationItem({
  conversation: c,
  onNavigate,
  mobile,
  active,
  dragging,
  onDragStart,
  onDragEnd,
  position,
}: {
  conversation: Conversation
  onNavigate?: () => void
  mobile: boolean
  active: boolean
  dragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  /** only for pinned conversations: enables Move up / Move down */
  position?: { index: number; count: number }
}) {
  const { togglePin, movePinned, askRename, askDelete } = useChatActions()
  const navigate = useNavigate()

  return (
    <li
      className={`group relative transition-opacity duration-150 ${dragging ? 'opacity-40' : ''}`}
      data-id={c.id}
      // drag a conversation to Pinned (pin / reorder) or to Recents (unpin); mouse only,
      // the "…" menu offers the same moves for keyboard and touch
      draggable={!mobile}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', c.id)
        onDragStart(c.id)
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        onClick={() => {
          navigate(`/chat/${c.id}`)
          onNavigate?.()
        }}
        aria-current={active ? 'page' : undefined}
        className={`relative flex w-full cursor-pointer items-center rounded-lg ps-3 text-start text-sm transition-colors duration-150 ${
          mobile ? 'min-h-11 pe-12' : 'py-1.5 pe-9'
        } ${
          active
            ? 'bg-primary/10 font-medium text-foreground before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-primary'
            : 'text-foreground/85 hover:bg-muted hover:text-foreground'
        }`}
      >
        <span dir="auto" lang={langOf(c.title)} className="truncate">
          {c.title}
        </span>
      </button>
      <div className="absolute inset-y-0 end-1 flex items-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:has-[[aria-expanded=true]]:opacity-100">
        <Menu
          label={`Options for ${c.title}`}
          items={[
            {
              label: c.pinned ? 'Unpin' : 'Pin',
              icon: c.pinned ? <PinOff /> : <Pin />,
              onSelect: () => togglePin(c.id),
            },
            ...(position && position.index > 0
              ? [{ label: 'Move up', icon: <ArrowUp />, onSelect: () => movePinned(c.id, -1) }]
              : []),
            ...(position && position.index < position.count - 1
              ? [{ label: 'Move down', icon: <ArrowDown />, onSelect: () => movePinned(c.id, 1) }]
              : []),
            { label: 'Rename', icon: <Pencil />, onSelect: () => askRename(c) },
            { label: 'Delete', icon: <Trash2 />, onSelect: () => askDelete(c), danger: true },
          ]}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className={`grid cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground ${
                mobile ? 'size-11' : 'size-7'
              }`}
              aria-label={`Options for ${c.title}`}
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
        />
      </div>
    </li>
  )
})

function SideLink({ to, label, icon, onNavigate }: { to: string; label: string; icon: ReactNode; onNavigate?: () => void }) {
  return (
    <NavLink
      to={to}
      end
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-200 max-md:min-h-11 ${
          isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <span className="grid size-7 place-items-center" aria-hidden="true">
        {icon}
      </span>
      {label}
    </NavLink>
  )
}

function RailLink({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `grid size-9 place-items-center rounded-lg transition-colors duration-200 ${
          isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      {icon}
    </NavLink>
  )
}

function Avatar() {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-secondary to-primary text-xs font-semibold text-white"
    >
      ML
    </span>
  )
}
