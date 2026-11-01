import { lazy, Suspense } from 'react'
import { stripMarkdown } from '../lib/text'

// Markdown + syntax highlighting is the heaviest code of the app and is not needed
// for the first screen: it is downloaded as soon as the browser is idle.
const loadMarkdown = () => import('./Markdown')
const Markdown = lazy(loadMarkdown)

if (typeof window !== 'undefined') {
  // Safari has no requestIdleCallback
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
  idle(() => void loadMarkdown())
}

export function LazyMarkdown({ content }: { content: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{stripMarkdown(content)}</p>}>
      <Markdown content={content} />
    </Suspense>
  )
}
