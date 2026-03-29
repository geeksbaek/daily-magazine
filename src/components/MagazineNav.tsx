import { useEffect, useState } from 'react'
import { formatIssueDate } from '../utils/format'
import ThemeSwitcher from './ThemeSwitcher'
import type { ThemeId } from '../hooks/useTheme'

interface Props {
  date: string
  issueNumber: number
  themeId: ThemeId
  onSetTheme: (id: ThemeId) => void
  onShowArchive: () => void
}

const SECTIONS = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'ai-ml', label: 'AI & ML' },
  { id: 'dev-tools', label: 'Dev Tools' },
  { id: 'big-tech', label: 'Big Tech' },
  { id: 'twitter-pulse', label: 'X' },
  { id: 'threads-pulse', label: 'Threads' },
  { id: 'reddit-pulse', label: 'Reddit' },
  { id: 'community-pulse', label: 'Community' },
  { id: 'quick-bites', label: 'Quick Bites' },
]

export default function MagazineNav({ date, issueNumber, themeId, onSetTheme, onShowArchive }: Props) {
  const [activeSection, setActiveSection] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60)
      const sectionEls = SECTIONS.map(s => ({
        id: s.id,
        el: document.getElementById(s.id),
      })).filter(s => s.el)
      const scrollPos = window.scrollY + 120
      let current = ''
      for (const { id, el } of sectionEls) {
        if (el && el.offsetTop <= scrollPos) current = id
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) window.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' })
    setMenuOpen(false)
  }

  const scrollToCover = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <nav
      style={{
        backgroundColor: scrolled ? 'var(--bg-surface)' : 'var(--bg)',
        borderBottomColor: 'var(--border)',
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: scrolled ? '0 1px 0 var(--border)' : 'none',
      }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-[60px]">
          {/* Logo */}
          <button onClick={scrollToCover} className="flex items-center gap-3 shrink-0">
            <span
              className="font-serif font-black text-[18px] tracking-[-0.02em] leading-none"
              style={{ color: 'var(--text)' }}
            >
              GEEK<span style={{ color: 'var(--accent)' }}>/</span>DAILY
            </span>
            <span
              className="hidden sm:block text-[10px] font-mono tracking-widest border px-1.5 py-0.5"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              #{String(issueNumber).padStart(3, '0')}
            </span>
          </button>

          {/* Desktop section links */}
          <div className="hidden lg:flex items-center gap-0">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="px-3 py-1.5 text-[11px] font-sans font-medium tracking-wide transition-colors"
                style={{
                  color: activeSection === s.id ? 'var(--accent)' : 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            <span
              className="hidden md:block text-[11px] font-mono mr-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {formatIssueDate(date)}
            </span>

            <button
              onClick={onShowArchive}
              className="hidden md:flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
                <rect x="1" y="5" width="10" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
                <rect x="1" y="9" width="6" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
              </svg>
              아카이브
            </button>

            {/* Theme switcher */}
            <ThemeSwitcher themeId={themeId} onSetTheme={onSetTheme} />

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden w-8 h-8 flex items-center justify-center"
              style={{ color: 'var(--text-secondary)' }}
            >
              {menuOpen ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="2" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="lg:hidden border-t"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-[1440px] mx-auto px-6 py-3 flex flex-col gap-0">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="text-left py-2.5 text-[13px] font-medium border-b last:border-0 transition-colors"
                style={{
                  color: activeSection === s.id ? 'var(--accent)' : 'var(--text)',
                  borderColor: 'var(--border)',
                }}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => { onShowArchive(); setMenuOpen(false) }}
              className="text-left py-2.5 text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              아카이브
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
