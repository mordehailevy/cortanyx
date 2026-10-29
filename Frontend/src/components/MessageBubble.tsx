import { motion, useReducedMotion } from 'framer-motion'
import type { UiMessage } from '../hooks/useChat'
import { LogoMark } from './Logo'
import { CopyButton, Markdown } from './Markdown'

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2" role="status" aria-label="Cortanyx is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 animate-bounce rounded-full bg-muted-foreground/70"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const reduce = useReducedMotion()
  const isUser = message.role === 'user'
  const waiting = message.streaming && !message.content

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`group flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && <LogoMark className="mt-1 size-8" />}

      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="sr-only">{isUser ? 'You said:' : 'Cortanyx said:'}</span>
        {isUser ? (
          <div
            dir="auto"
            className="max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-ee-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-on-primary shadow-sm"
          >
            {message.content}
          </div>
        ) : (
          <div
            dir="auto"
            className={`prose prose-slate max-w-full break-words rounded-2xl rounded-es-md border border-border bg-surface px-4 py-2.5 text-[15px] leading-relaxed dark:prose-invert prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-li:my-0.5 ${
              message.streaming && message.content ? 'streaming-caret' : ''
            }`}
          >
            {waiting ? <TypingDots /> : <Markdown content={message.content} />}
          </div>
        )}

        {!isUser && !message.streaming && message.content && (
          <div className="mt-1 text-muted-foreground opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </motion.li>
  )
}
