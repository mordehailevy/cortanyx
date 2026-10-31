import { describe, expect, it } from 'vitest'
import type { Conversation } from './api'
import { anchorAt, pinnedOrderWith, sortConversations } from './pinned'

function conv(id: string, pin_order: number | null, updated_at = '2026-11-01T10:00:00Z'): Conversation {
  return { id, title: id, model: 'm', pinned: true, pin_order, created_at: updated_at, updated_at }
}
const pinned = (id: string, order: number | null) => conv(id, order)
const recent = (id: string, updated_at: string) => ({ ...conv(id, null, updated_at), pinned: false })

// pinned A, B, C (+ an older pinned D never ordered) and two recents
const all = [recent('r1', '2026-11-01T09:00:00Z'), pinned('C', 2), pinned('D', null), pinned('A', 0), recent('r2', '2026-11-01T11:00:00Z'), pinned('B', 1)]

describe('sortConversations', () => {
  it('puts pinned first in their order, never-ordered pinned last, then recents by activity', () => {
    expect(sortConversations(all).map((c) => c.id)).toEqual(['A', 'B', 'C', 'D', 'r2', 'r1'])
  })
})

describe('pinnedOrderWith', () => {
  it('moves a pinned conversation before its new neighbour', () => {
    expect(pinnedOrderWith(all, 'C', { beforeId: 'A' })).toEqual(['C', 'A', 'B', 'D'])
  })

  it('works from a filtered list: C dropped above A while the search shows only A and C', () => {
    // visible pinned list during the search: [A, C]; the line is drawn at index 0
    expect(pinnedOrderWith(all, 'C', anchorAt(['A', 'C'], 'C', 0))).toEqual(['C', 'A', 'B', 'D'])
  })

  it('Move up in a filtered list swaps with the visible neighbour', () => {
    expect(pinnedOrderWith(all, 'C', { beforeId: 'A' })).toEqual(['C', 'A', 'B', 'D'])
    expect(pinnedOrderWith(all, 'A', { afterId: 'C' })).toEqual(['B', 'C', 'A', 'D'])
  })

  it('pins a recent conversation at the drop place', () => {
    expect(pinnedOrderWith(all, 'r1', anchorAt(['A', 'B', 'C', 'D'], 'r1', 0))).toEqual(['r1', 'A', 'B', 'C', 'D'])
    expect(pinnedOrderWith(all, 'r1', anchorAt(['A', 'B', 'C', 'D'], 'r1', 4))).toEqual(['A', 'B', 'C', 'D', 'r1'])
  })

  it('returns null when dropped on itself (no request)', () => {
    expect(pinnedOrderWith(all, 'B', anchorAt(['A', 'B', 'C', 'D'], 'B', 1))).toBeNull()
    expect(pinnedOrderWith(all, 'B', anchorAt(['A', 'B', 'C', 'D'], 'B', 2))).toBeNull()
  })

  it('goes to the end when the anchor no longer exists', () => {
    expect(pinnedOrderWith(all, 'A', { beforeId: 'gone' })).toEqual(['B', 'C', 'D', 'A'])
  })
})

describe('anchorAt', () => {
  it('accounts for the dragged item still being in the list', () => {
    expect(anchorAt(['A', 'B', 'C'], 'A', 3)).toEqual({ afterId: 'C' })
    expect(anchorAt(['A', 'B', 'C'], 'A', 2)).toEqual({ beforeId: 'C' })
    expect(anchorAt([], 'X', 0)).toEqual({ afterId: null })
  })
})
