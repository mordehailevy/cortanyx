import { motion, useReducedMotion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { memo } from 'react'
import type { UiMessage } from '../hooks/useChat'
import { langOf } from '../lib/text'
import { CopyButton } from './CopyButton'
import { LazyMarkdown } from './LazyMarkdown'

// the nodes of the logo's M, in the order the light runs through them
const M_NODES = [
  [31.6, 71.3],
  [31.6, 28.6],
  [50, 50],
  [68.4, 28.6],
  [68.4, 71.3],
]

/** "Thinking" indicator: a light runs along the M of the logo and wakes its nodes in turn. */
function ThinkingMark() {
  return (
    <span className="inline-flex py-1.5 text-primary" role="status" aria-label="Cortanyx is thinking">
      <svg viewBox="22 19 56 62" className="h-6 w-auto" aria-hidden="true">
        <path d="M31.6 71.3V28.6L50 50l18.4-21.4v42.7" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" strokeLinejoin="round" />
        <path
          className="thinking-trail"
          d="M31.6 71.3V28.6L50 50l18.4-21.4v42.7"
          pathLength={100}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {M_NODES.map(([cx, cy], i) => (
          <circle key={i} className="thinking-node" cx={cx} cy={cy} r="5.5" fill="currentColor" style={{ animationDelay: `${i * 0.24}s` }} />
        ))}
      </svg>
    </span>
  )
}

const actionBtn =
  'inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors duration-200 hover:bg-current/10 max-md:min-h-11 max-md:min-w-11 max-md:justify-center'

/** Memoized: while an answer streams, only the streaming bubble re-renders. */
export const MessageBubble = memo(function MessageBubble({
  message,
  onRegenerate,
}: {
  message: UiMessage
  /** only passed for the last answer, when nothing is streaming */
  onRegenerate?: () => void
}) {
  const reduce = useReducedMotion()
  const isUser = message.role === 'user'
  const waiting = message.streaming && !message.content
  const lang = langOf(message.content)

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`group flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex min-w-0 flex-col ${isUser ? 'max-w-[85%] items-end sm:max-w-[75%]' : 'flex-1 items-start'}`}>
        <span className="sr-only">{isUser ? 'You said:' : 'Cortanyx said:'}</span>
        {isUser ? (
          <div
            dir="auto"
            lang={lang}
            className="max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-ee-md bg-muted px-4 py-2.5 text-[15px] leading-relaxed text-foreground"
          >
            {message.content}
          </div>
        ) : (
          <div
            dir="auto"
            lang={lang}
            className={`prose prose-stone max-w-full break-words pt-0.5 text-[15px] leading-relaxed dark:prose-invert prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-li:my-0.5 ${
              message.streaming && message.content ? 'streaming-caret' : ''
            }`}
          >
            {waiting ? <ThinkingMark /> : <LazyMarkdown content={message.content} />}
          </div>
        )}

        {!isUser && !message.streaming && message.content && (
          <div
            className={`mt-1 flex items-center gap-1 text-muted-foreground transition-opacity duration-200 ${
              onRegenerate ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
            }`}
          >
            <CopyButton text={message.content} className={actionBtn} />
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} className={actionBtn} aria-label="Regenerate this answer">
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span className="max-md:sr-only">Regenerate</span>
              </button>
            )}
            {(message.stopped || message.interrupted) && (
              <span role="status" className="ms-1 text-xs italic">
                Stopped
              </span>
            )}
          </div>
        )}
      </div>
    </motion.li>
  )
})
