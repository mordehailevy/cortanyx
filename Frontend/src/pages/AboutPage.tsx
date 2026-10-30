import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Database,
  FileCode2,
  Languages,
  Layers,
  Lock,
  MessagesSquare,
  Server,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../components/Logo'

export const GITHUB_URL = 'https://github.com/mordehailevy/cortanyx'

const features = [
  { icon: MessagesSquare, title: 'Real conversations', text: 'Every answer uses the whole conversation as context, stored in MySQL.' },
  { icon: Zap, title: 'Live streaming', text: 'Answers appear word by word (Server-Sent Events), with Stop and Regenerate.' },
  { icon: FileCode2, title: 'Rich answers', text: 'Markdown, tables and syntax-highlighted code with one-click copy.' },
  { icon: Languages, title: 'Hebrew, English, French', text: 'Each message picks its own direction: right-to-left or left-to-right.' },
  { icon: Layers, title: 'History', text: 'Pinned and recent conversations (drag and drop), search, auto titles, rename, delete.' },
  { icon: Lock, title: 'Secure by design', text: 'OpenAI is called only by the server; the API key lives in a server-side .env.' },
]

const stack = [
  { icon: Sparkles, layer: 'Frontend', items: 'React 19 · TypeScript · Vite · Tailwind CSS · Framer Motion' },
  { icon: Server, layer: 'Backend', items: 'Python · FastAPI · SQLAlchemy · Pydantic · OpenAI SDK · pytest' },
  { icon: Database, layer: 'Database', items: 'MySQL 8+ · conversations & messages tables · readable SQL view' },
]

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 220, damping: 26, delay }}
    >
      {children}
    </motion.div>
  )
}

export function AboutPage() {
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <LogoMark className="size-14" />
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">About Cortanyx</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              A ChatGPT-style assistant that holds a continuous conversation, built from scratch as the final project of
              the Full Stack Web Developer program.
            </p>
          </div>
        </Reveal>

        <section aria-labelledby="features" className="mt-14">
          <h2 id="features" className="text-xl font-semibold">
            What it does
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <li key={f.title}>
                <Reveal delay={0.04 * i}>
                  <div className="h-full rounded-2xl border border-border bg-surface p-5">
                    <f.icon className="size-5 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="architecture" className="mt-14">
          <h2 id="architecture" className="text-xl font-semibold">
            How it works
          </h2>
          <Reveal>
            <ol className="mt-5 flex flex-col items-stretch gap-3 text-sm sm:flex-row sm:items-center">
              {['React SPA', 'FastAPI REST API', 'MySQL', 'OpenAI API'].map((step, i, all) => (
                <li key={step} className="flex flex-1 items-center gap-3">
                  <span className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-center font-medium">
                    {step}
                  </span>
                  {i < all.length - 1 && (
                    <ArrowRight className="size-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">
              The browser only talks to the REST API. For each message the server saves it, loads the conversation
              history from MySQL, sends it to OpenAI with a system prompt, streams the answer back and saves it.
            </p>
          </Reveal>
          <ul className="mt-6 grid gap-3">
            {stack.map((s) => (
              <li key={s.layer}>
                <Reveal>
                  <div className="flex items-start gap-4 rounded-2xl border border-border p-4">
                    <s.icon className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold">{s.layer}</h3>
                      <p className="text-sm text-muted-foreground">{s.items}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="developer" className="mt-14">
          <Reveal>
            <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent p-6 sm:p-8">
              <h2 id="developer" className="text-xl font-semibold">
                The developer
              </h2>
              <p className="mt-1 text-2xl font-bold tracking-tight">Mordehai Levy</p>
              <p className="mt-1 text-muted-foreground">Full Stack Web Developer · Python · React · AI automation</p>
              <p className="mt-4 max-w-2xl">
                I designed and built every layer of Cortanyx: the MySQL schema, the FastAPI REST API, the prompt design, the
                React interface and the tests. Final project of the Full Stack Web Developer program at John Bryce.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-transform duration-150 hover:scale-[1.03]"
                >
                  <FileCode2 className="size-4" aria-hidden="true" /> Source code on GitHub
                </a>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-muted"
                >
                  Try the chat <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  )
}
