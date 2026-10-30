import { useEffect, type RefObject } from 'react'

// Open traps, innermost last: only the top one handles Escape and Tab
// (a dialog opened from the mobile drawer must not close the drawer too).
const stack: symbol[] = []

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * While `active`: moves focus into `ref`, keeps Tab / Shift+Tab inside it and
 * calls `onEscape` on Escape. When it ends, focus goes to `returnTo` when given,
 * else back to the element that had it before.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
  returnTo?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return
    const token = Symbol('focus-trap')
    stack.push(token)
    const previous = document.activeElement as HTMLElement | null
    const container = ref.current
    const fallback = returnTo?.current ?? null
    // focus the element marked data-autofocus, else the first focusable one
    const initial =
      container?.querySelector<HTMLElement>('[data-autofocus]') ?? container?.querySelector<HTMLElement>(FOCUSABLE)
    // focus now (the panel is in the DOM after commit), and once more on the next
    // frame in case an animation library moved focus meanwhile
    initial?.focus()
    const raf = requestAnimationFrame(() => {
      if (container && !container.contains(document.activeElement)) initial?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape()
        return
      }
      if (e.key !== 'Tab' || !container) return
      const nodes = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      // a pending initial focus must not land in the panel after it closed
      cancelAnimationFrame(raf)
      stack.splice(stack.indexOf(token), 1)
      window.removeEventListener('keydown', onKey)
      // an explicit return target wins (a click does not always focus the button that opened the trap)
      const target = fallback ?? (previous && document.contains(previous) ? previous : null)
      target?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
