import { Moon, Sun } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { LogoMark } from './Logo'

const links = [
  { to: '/', label: 'Chat' },
  { to: '/about', label: 'About' },
]

export function Header() {
  const { theme, toggle } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur">
      <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Cortanyx home">
        <LogoMark />
        <span className="text-lg">Cortanyx</span>
      </NavLink>

      <nav aria-label="Main menu" className="ms-auto flex items-center gap-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggle}
          className="ms-1 grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
      </nav>
    </header>
  )
}
