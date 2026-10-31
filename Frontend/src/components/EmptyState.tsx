import { motion, useReducedMotion } from 'framer-motion'
import { Code2, Languages, Lightbulb, PenLine } from 'lucide-react'
import type { ReactNode } from 'react'
import { LogoMark } from './Logo'

const suggestions = [
  { icon: Code2, title: 'Code', prompt: 'Explain what a REST API is, with a short FastAPI example.' },
  { icon: Lightbulb, title: 'Brainstorm', prompt: 'Give me 5 original ideas for a weekend project with React.' },
  { icon: Languages, title: 'עברית', prompt: 'הסבר לי בקצרה מה ההבדל בין SQL ל-NoSQL' },
  { icon: PenLine, title: 'Write', prompt: 'Write a short, friendly LinkedIn post announcing I finished a Full Stack course.' },
]

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** New chat screen: greeting, centered composer and suggestion chips (Claude-style). */
export function EmptyState({
  onPick,
  composer,
  errorBanner,
}: {
  onPick: (prompt: string) => void
  composer: ReactNode
  errorBanner: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-1 py-10">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="mb-6 flex items-center justify-center gap-3 px-4"
      >
        <LogoMark className="size-9 sm:size-10" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{greeting()}</h1>
      </motion.div>
      <p className="mb-6 px-4 text-center text-muted-foreground">
        Think out loud, in any language.
        <br className="max-sm:hidden" /> Cortanyx connects every thread of your conversation.
      </p>

      {errorBanner}
      {composer}

      <ul className="mt-2 flex flex-wrap justify-center gap-2 px-4" aria-label="Suggestions">
        {suggestions.map((s, i) => (
          <motion.li
            key={s.title}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.05 * i + 0.1, type: 'spring', stiffness: 300, damping: 26 }}
          >
            <motion.button
              type="button"
              onClick={() => onPick(s.prompt)}
              title={s.prompt}
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm max-md:min-h-11 text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-foreground"
            >
              <s.icon className="size-4 text-primary" aria-hidden="true" />
              <span dir="auto">{s.title}</span>
              <span className="sr-only">: {s.prompt}</span>
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
