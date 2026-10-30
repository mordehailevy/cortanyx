import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
}

interface Props {
  /** Renders the trigger; receives the props a menu button needs. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>
    onClick: () => void
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    'aria-controls': string
  }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  /** accessible name of the menu */
  label: string
}

/** Small accessible dropdown menu (click / Enter to open, arrows to move, Esc to close). */
export function Menu({ trigger, items, align = 'end', label }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const reduce = useReducedMotion()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div className="relative">
      {trigger({
        ref: buttonRef,
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id={id}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className={`absolute top-full z-50 mt-1 min-w-44 rounded-xl border border-border bg-background p-1 shadow-lg ${
              align === 'end' ? 'end-0' : 'start-0'
            }`}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  // give focus back to the trigger first, so a dialog opened by the
                  // item returns focus there when it closes
                  close(true)
                  item.onSelect()
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition-colors duration-150 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:min-h-11 ${
                  item.danger ? 'text-destructive' : 'text-foreground'
                }`}
              >
                <span className="size-4 shrink-0 [&>svg]:size-4" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
