import { lazy, Suspense } from 'react'

// Markdown + syntax highlighting is the heaviest code of the app and is not needed
// for the first screen: it is downloaded with the first answer.
const Markdown = lazy(() => import('./Markdown'))

export function LazyMarkdown({ content }: { content: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{content}</p>}>
      <Markdown content={content} />
    </Suspense>
  )
}
