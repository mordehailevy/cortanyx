import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useState } from 'react'

const M_PATH = 'M31.6 71.3V28.6L50 50l18.4-21.4v42.7'
// outer nodes in the order the pen reaches them
const NODES = [
  [31.6, 71.3, 0.05],
  [31.6, 28.6, 0.25],
  [68.4, 28.6, 0.55],
  [68.4, 71.3, 0.75],
]

// the home screen logo weaves itself only once per visit, not at every "New chat"
let woven = false

/** Cortanyx mark: an "M" drawn as a small network of nodes (same drawing as public/favicon.svg). */
export function LogoMark({ className = 'size-8', animated = false }: { className?: string; animated?: boolean }) {
  const gradient = useId()
  const reduce = useReducedMotion()
  const [play] = useState(() => animated && !reduce && !woven)
  useEffect(() => {
    if (play) woven = true
  }, [play])

  const pop = (delay: number) =>
    play
      ? {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, stiffness: 500, damping: 22, delay },
        }
      : {}

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`${className} shrink-0`}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2D2170" />
          <stop offset="1" stopColor="#11306A" />
        </linearGradient>
      </defs>
      <motion.circle
        cx="50"
        cy="50"
        r="50"
        fill={`url(#${gradient})`}
        {...(play && { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } })}
      />
      <motion.path
        d={M_PATH}
        fill="none"
        stroke="#A09AE6"
        strokeWidth="2.6"
        strokeLinejoin="round"
        {...(play && {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 0.75, delay: 0.1, ease: 'easeInOut' },
        })}
      />
      <g fill="#E8E6FB">
        {NODES.map(([cx, cy, delay]) => (
          <motion.circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.9" {...pop(delay)} />
        ))}
      </g>
      <motion.g {...pop(0.4)}>
        <circle cx="50" cy="50" r="5.5" fill="#fff" />
        <circle cx="50" cy="50" r="2.4" fill="#4434A8" />
      </motion.g>
    </svg>
  )
}
