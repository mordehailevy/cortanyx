import { Check, Copy } from 'lucide-react'
import { memo, useState, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors duration-200 hover:bg-current/10"
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node)
    return textOf((node as { props: { children?: ReactNode } }).props.children)
  return ''
}

function CodeBlock({ children, ...rest }: ComponentProps<'pre'>) {
  const child = Array.isArray(children) ? children[0] : children
  const className: string = (child as { props?: { className?: string } })?.props?.className ?? ''
  const lang = /language-([\w+-]+)/.exec(className)?.[1] ?? 'text'
  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-white/10 text-sm" dir="ltr">
      <div className="flex items-center justify-between bg-[#161b22] px-3 py-1 text-slate-300">
        <span className="font-mono text-xs">{lang}</span>
        <CopyButton text={textOf(children).replace(/\n$/, '')} label="Copy code" />
      </div>
      <pre {...rest} className="overflow-x-auto bg-[#0d1117] p-4 font-mono leading-relaxed text-slate-100 [font-variant-ligatures:none]">
        {children}
      </pre>
    </div>
  )
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        pre: CodeBlock,
        a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
})
