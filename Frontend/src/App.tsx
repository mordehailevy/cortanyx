import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Menu as MenuIcon, SquarePen } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppSidebar } from './components/AppSidebar'
import { LogoMark } from './components/Logo'
import { langOf } from './lib/text'
import { ChatProvider, useChatContext } from './context/ChatContext'
import { useFocusTrap } from './hooks/useFocusTrap'
import { ChatPage } from './pages/ChatPage'

// About is not needed to chat: load it on demand to keep the first download small
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })))

const noop = () => {}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebar-collapsed') === '1'
  } catch {
    return false
  }
}

function Shell() {
  const reduce = useReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const chat = useChatContext()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // stable: memoized conversation items do not re-render for every streamed word
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const drawerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false), menuButtonRef)

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1')
      } catch {
        /* not remembered in private mode */
      }
      return !c
    })

  const current = chat.conversations.find((c) => c.id === chat.conversationId)
  // a conversation link still loading: no "New chat" flash in the tab title
  const pageTitle =
    location.pathname === '/about' ? 'About' : (current?.title ?? (location.pathname.startsWith('/chat/') ? null : 'New chat'))

  // any navigation closes the mobile drawer (e.g. deleting the open conversation from it);
  // adjusted while rendering, as React recommends for state that follows a prop
  const [drawerPath, setDrawerPath] = useState(location.pathname)
  if (drawerPath !== location.pathname) {
    setDrawerPath(location.pathname)
    if (drawerOpen) setDrawerOpen(false)
  }

  // the browser tab tells where you are (and screen readers announce it)
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · Cortanyx` : 'Cortanyx'
  }, [pageTitle])

  return (
    <div className="flex h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 border-e border-border bg-surface transition-[width] duration-200 md:block ${
          collapsed ? 'w-14' : 'w-[272px]'
        }`}
      >
        <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu and conversation history"
              className="fixed inset-y-0 start-0 z-50 w-[85%] max-w-[300px] border-e border-border bg-surface shadow-xl md:hidden"
              initial={reduce ? { opacity: 0 } : { x: '-100%' }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <AppSidebar collapsed={false} onToggleCollapsed={noop} onNavigate={closeDrawer} mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* inert: the page behind the open mobile drawer cannot be reached */}
      <div className="flex min-w-0 flex-1 flex-col" inert={drawerOpen}>
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
          <LogoMark className="size-6" />
          <span dir="auto" lang={langOf(pageTitle ?? '')} className="min-w-0 flex-1 truncate text-sm font-medium">
            {pageTitle}
          </span>
          <button
            type="button"
            onClick={() => {
              chat.newChat()
              navigate('/')
            }}
            className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="New chat"
          >
            <SquarePen className="size-5" />
          </button>
        </header>

        <main id="main" className="min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/chat/:id" element={<ChatPage />} />
            <Route
              path="/about"
              element={
                <Suspense fallback={<div className="p-8 text-sm text-muted-foreground" role="status">Loading…</div>}>
                  <AboutPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ChatProvider>
        <Shell />
      </ChatProvider>
    </BrowserRouter>
  )
}
