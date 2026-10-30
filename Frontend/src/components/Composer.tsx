import { ArrowUp, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

const MAX_CHARS = 8000

// No automatic focus before the user has done anything on the page: on load, Tab
// must reach "Skip to content" first, and a phone must not open its keyboard.
let userHasInteracted = false
for (const type of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(type, () => (userHasInteracted = true), { once: true, capture: true })
}

interface Props {
  onSend: (text: string) => void
  onStop: () => void
  isStreaming: boolean
  focusKey: unknown
  /** text to start with (a cancelled message given back) */
  initialValue?: string
}

export function Composer({ onSend, onStop, isStreaming, focusKey, initialValue = '' }: Props) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLTextAreaElement>(null)

  // focus the input on "new conversation", on opening a conversation and after each answer
  useEffect(() => {
    if (userHasInteracted && !isStreaming) ref.current?.focus()
  }, [focusKey, isStreaming])

  // auto-grow up to ~8 lines
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = ''
    if (!value) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [value])

  const tooLong = value.length > MAX_CHARS
  const canSend = value.trim().length > 0 && !tooLong && !isStreaming

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    onSend(value)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-surface p-2 shadow-sm transition-shadow duration-200 focus-within:border-primary focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring/30">
        <label htmlFor="composer" className="sr-only">
          Message Cortanyx
        </label>
        <textarea
          id="composer"
          ref={ref}
          dir="auto"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message Cortanyx…"
          className="max-h-[220px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:outline-none"
          aria-describedby="composer-hint"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-foreground text-background transition-transform duration-150 hover:scale-105 active:scale-95"
            aria-label="Stop generating"
          >
            <Square className="size-4" fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-primary text-on-primary transition-transform duration-150 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Send message"
          >
            <ArrowUp className="size-5" />
          </button>
        )}
      </div>
      <p id="composer-hint" className="mt-2 text-center text-xs text-muted-foreground">
        {tooLong ? (
          <span className="text-destructive">
            {value.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters - please shorten your message
          </span>
        ) : (
          <>
            <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift + Enter</kbd> for a new
            line · Cortanyx can make mistakes
          </>
        )}
      </p>
    </form>
  )
}
