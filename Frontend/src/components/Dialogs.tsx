import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { langOf } from '../lib/text'

function Modal({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open, onClose)

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

const btn = 'cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200'

export function ConfirmDeleteDialog({
  title,
  open,
  onCancel,
  onConfirm,
}: {
  title: string
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="delete-title">
      <h2 id="delete-title" className="text-lg font-semibold">
        Delete conversation?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        “<bdi lang={langOf(title)} className="font-medium text-foreground">{title}</bdi>”{' '}
        and all its messages will be permanently deleted.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" data-autofocus onClick={onCancel} className={`${btn} border border-border hover:bg-muted`}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={`${btn} bg-destructive text-on-destructive hover:brightness-110`}>
          Delete
        </button>
      </div>
    </Modal>
  )
}

export function RenameDialog({
  title,
  open,
  onCancel,
  onSave,
}: {
  title: string
  open: boolean
  onCancel: () => void
  onSave: (title: string) => void
}) {
  const [value, setValue] = useState(title)
  // reset the field each time the dialog opens for a conversation
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setValue(title)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = value.trim()
    if (t) onSave(t)
  }

  return (
    <Modal open={open} onClose={onCancel} labelledBy="rename-title">
      <form onSubmit={submit}>
        <h2 id="rename-title" className="text-lg font-semibold">
          Rename conversation
        </h2>
        <label htmlFor="rename-input" className="sr-only">
          Title
        </label>
        <input
          id="rename-input"
          data-autofocus
          dir="auto"
          maxLength={120}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="mt-4 w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={`${btn} border border-border hover:bg-muted`}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className={`${btn} bg-primary text-on-primary hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
