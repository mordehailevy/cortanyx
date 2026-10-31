import type { Conversation } from './api'

/**
 * Where to put a pinned conversation, given by its neighbours rather than by an index:
 * the sidebar may show a filtered list (search), the neighbours stay right in the full one.
 * `beforeId` wins; with neither, the conversation goes to the end.
 */
export interface PinAnchor {
  beforeId?: string | null
  afterId?: string | null
}

/** Same order as the server: pinned first (in the chosen order, never-ordered last), then latest activity. */
export function sortConversations(list: Conversation[]): Conversation[] {
  const order = (c: Conversation) => c.pin_order ?? Number.MAX_SAFE_INTEGER
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (a.pinned ? order(a) - order(b) : 0) ||
      b.updated_at.localeCompare(a.updated_at),
  )
}

/**
 * The full list of pinned ids once `id` is placed at `anchor` (pinning it if needed),
 * or null when nothing would change (dropped on itself), so no request is sent.
 */
export function pinnedOrderWith(all: Conversation[], id: string, anchor: PinAnchor): string[] | null {
  const current = sortConversations(all)
    .filter((c) => c.pinned)
    .map((c) => c.id)
  const rest = current.filter((x) => x !== id)
  let at = rest.length
  if (anchor.beforeId && rest.includes(anchor.beforeId)) at = rest.indexOf(anchor.beforeId)
  else if (anchor.afterId && rest.includes(anchor.afterId)) at = rest.indexOf(anchor.afterId) + 1
  const next = [...rest.slice(0, at), id, ...rest.slice(at)]
  return next.join() === current.join() ? null : next
}

/**
 * Drag and drop: `index` is where the line is drawn in the visible pinned list, which still
 * contains the dragged conversation; returns its neighbours once it is moved there.
 */
export function anchorAt(visibleIds: string[], id: string, index: number): PinAnchor {
  const from = visibleIds.indexOf(id)
  const rest = visibleIds.filter((x) => x !== id)
  const at = from !== -1 && from < index ? index - 1 : index
  return at < rest.length ? { beforeId: rest[at] } : { afterId: rest[rest.length - 1] ?? null }
}
