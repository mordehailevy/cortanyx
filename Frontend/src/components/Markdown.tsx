import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { memo, useMemo, type ComponentProps, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CopyButton } from './CopyButton'

// Only the languages people ask about most: the full highlight.js set doubled this chunk.
// Each grammar brings its aliases (py, js, ts, sh, html, jsx...).
for (const [name, grammar] of Object.entries({ bash, cpp, csharp, css, java, javascript, json, python, sql, typescript, xml, yaml })) {
  hljs.registerLanguage(name, grammar)
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node)
    return textOf((node as { props: { children?: ReactNode } }).props.children)
  return ''
}

function CodeBlock({ children, node: _node, ...rest }: ComponentProps<'pre'> & { node?: unknown }) {
  const child = Array.isArray(children) ? children[0] : children
  const className: string = (child as { props?: { className?: string } })?.props?.className ?? ''
  const lang = /language-([\w+-]+)/.exec(className)?.[1] ?? 'text'
  const code = textOf(children).replace(/\n$/, '')
  // highlight.js escapes the code it returns, so this HTML only contains its own <span> tags
  const html = useMemo(
    () => (hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : null),
    [code, lang],
  )
  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-white/10 text-sm" dir="ltr">
      <div className="flex items-center justify-between bg-[#161b22] px-3 py-1 text-slate-300">
        <span className="font-mono text-xs">{lang}</span>
        <CopyButton text={code} label="Copy code" />
      </div>
      <pre {...rest} className="overflow-x-auto bg-[#0d1117] p-4 font-mono leading-relaxed text-slate-100 [font-variant-ligatures:none]">
        {html === null ? <code>{code}</code> : <code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} />}
      </pre>
    </div>
  )
}

const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: CodeBlock,
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        // never load images chosen by the model (privacy): show a link instead
        img: ({ src, alt }) => (
          <a href={typeof src === 'string' ? src : undefined} target="_blank" rel="noopener noreferrer">
            {alt || 'image'}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
})

export default Markdown
