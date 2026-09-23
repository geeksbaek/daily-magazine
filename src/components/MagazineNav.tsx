import { useEffect, useState } from 'react'
import { formatIssueDate } from '../utils/format'
import ThemeSwitcher from './ThemeSwitcher'
import DesignSwitcher from './DesignSwitcher'
import type { ThemeId } from '../hooks/useTheme'

export interface SectionLink {
  id: string
  label: string
  count: number
}

interface Props {
  date: string
  issueNumber: number
  sections: SectionLink[]
  view: 'magazine' | 'archive'
  themeId: ThemeId
  onSetTheme: (id: ThemeId) => void
  designId: string
  onSetDesign: (id: string) => void
  onShowArchive: () => void
  onHome: () => void
  onJump: (id: string) => void
  /** whole-issue scroll percentage; null hides the indicator */
  progress?: number | null
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold leading-none tracking-[-0.03em] text-ink ${className}`}>
      GEEK<span className="text-accent">/</span>DAILY
    </span>
  )
}

export default function MagazineNav({ date, issueNumber, sections, view, themeId, onSetTheme, designId, onSetDesign, onShowArchive, onHome, onJump, progress = null }: Props) {
  const [active, setActive] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      const pos = window.scrollY + 120
      let current = ''
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.offsetTop <= pos) current = s.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sections])

  const jump = (id: string) => { onJump(id); setMenuOpen(false) }

  return (
    // No colour transition here: while the fixed nav animates, iOS home-screen web apps stop
    // treating it as a solid top bar and blur the status-bar edge over it for good.
    <nav
      data-part="nav"
      className="nav-bar fixed inset-x-0 top-0 z-50 border-b bg-paper"
      style={{ borderColor: scrolled || menuOpen ? 'var(--rule)' : 'transparent' }}
      aria-label="주 메뉴"
    >
      <div className="wrap flex h-14 items-center justify-between gap-4">
        <button type="button" onClick={onHome} className="flex shrink-0 items-baseline gap-2.5" aria-label="첫 화면으로">
          <Wordmark className="text-[19px]" />
          <span className="hidden text-[12px] text-ink-3 tabular sm:inline">제{issueNumber}호</span>
        </button>

        {view === 'magazine' && (
          <div className="hidden min-w-0 items-center lg:flex">
            {sections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className="px-2.5 py-1.5 text-[13px] transition-colors"
                style={{ color: active === s.id ? 'var(--accent)' : 'var(--ink-2)', fontWeight: active === s.id ? 600 : 500 }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1">
          {progress !== null && scrolled && <NavProgress pct={progress} />}
          <span className="hidden pr-2 text-[12.5px] text-ink-3 tabular md:inline">{formatIssueDate(date)}</span>
          <button
            type="button"
            onClick={view === 'archive' ? onHome : onShowArchive}
            className="hidden h-9 items-center px-3 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink md:flex"
          >
            {view === 'archive' ? '최신 호' : '지난 호'}
          </button>
          <DesignSwitcher designId={designId} onSetDesign={onSetDesign} />
          <ThemeSwitcher themeId={themeId} onSetTheme={onSetTheme} />
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="flex h-9 w-9 items-center justify-center text-ink-2 lg:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M2 2l12 12M14 2 2 14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {progress !== null && (
        <div className="progress-line" aria-hidden="true" style={{ transform: `scaleX(${progress / 100})` }} />
      )}

      {menuOpen && (
        <div className="border-t border-rule bg-paper lg:hidden">
          <div className="wrap py-2">
            {view === 'magazine' && sections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className="flex w-full items-baseline justify-between border-b border-rule py-3 text-left text-[15px] font-medium"
                style={{ color: active === s.id ? 'var(--accent)' : 'var(--ink)' }}
              >
                <span>{s.label}</span>
                <span className="text-[12.5px] text-ink-3 tabular">{s.count}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { if (view === 'archive') onHome(); else onShowArchive(); setMenuOpen(false) }}
              className="w-full py-3 text-left text-[15px] font-medium text-ink-2"
            >
              {view === 'archive' ? '최신 호로' : '지난 호 보기'}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

/** Narrow screens only (the wide-screen rail shows its own): a small ring plus the percentage. */
function NavProgress({ pct }: { pct: number }) {
  const r = 6.5
  const c = 2 * Math.PI * r
  return (
    <span className="nav-progress" role="progressbar" aria-label="이번 호를 읽은 정도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r={r} fill="none" stroke="var(--rule-2)" strokeWidth="1.5" />
        <circle
          cx="8" cy="8" r={r} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 8 8)"
        />
      </svg>
      {pct}%
    </span>
  )
}
