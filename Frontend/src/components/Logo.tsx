import { useId } from 'react'

/** Cortanyx mark: an "M" drawn as a small network of nodes (same drawing as public/favicon.svg). */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  const gradient = useId()
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`${className} shrink-0`}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2D2170" />
          <stop offset="1" stopColor="#11306A" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${gradient})`} />
      <path
        d="M31.6 71.3V28.6L50 50l18.4-21.4v42.7"
        fill="none"
        stroke="#A09AE6"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <g fill="#E8E6FB">
        <circle cx="31.6" cy="28.6" r="4.9" />
        <circle cx="68.4" cy="28.6" r="4.9" />
        <circle cx="31.6" cy="71.3" r="4.9" />
        <circle cx="68.4" cy="71.3" r="4.9" />
      </g>
      <circle cx="50" cy="50" r="5.5" fill="#fff" />
      <circle cx="50" cy="50" r="2.4" fill="#4434A8" />
    </svg>
  )
}
