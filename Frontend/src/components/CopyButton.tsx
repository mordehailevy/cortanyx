import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
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
      className={
        className ??
        'inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors duration-200 hover:bg-current/10 max-md:min-h-11'
      }
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
