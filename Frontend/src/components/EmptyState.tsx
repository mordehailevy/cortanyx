import { motion, useReducedMotion } from 'framer-motion'
import { Code2, Languages, Lightbulb, PenLine } from 'lucide-react'
import { LogoMark } from './Logo'

const suggestions = [
  { icon: Code2, title: 'Explain code', prompt: 'Explain what a REST API is, with a short FastAPI example.' },
  { icon: Lightbulb, title: 'Brainstorm', prompt: 'Give me 5 original ideas for a weekend project with React.' },
  { icon: Languages, title: 'בעברית', prompt: 'הסבר לי בקצרה מה ההבדל בין SQL ל-NoSQL' },
  { icon: PenLine, title: 'Write', prompt: 'Write a short, friendly LinkedIn post announcing I finished a Full Stack course.' },
]

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  const reduce = useReducedMotion()
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <LogoMark className="size-14" />
      </motion.div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">How can I help you today?</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Ask anything in English, עברית or français. Cortanyx remembers the whole conversation.
      </p>

      <ul className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <motion.li
            key={s.title}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.05 * i, type: 'spring', stiffness: 300, damping: 26 }}
          >
            <motion.button
              type="button"
              onClick={() => onPick(s.prompt)}
              whileHover={reduce ? undefined : { y: -3 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex h-full w-full cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-start transition-colors duration-200 hover:border-primary/50"
            >
              <s.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{s.title}</span>
                <span dir="auto" className="mt-0.5 block text-sm text-muted-foreground">
                  {s.prompt}
                </span>
              </span>
            </motion.button>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
