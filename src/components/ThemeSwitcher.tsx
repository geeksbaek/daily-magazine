import { useState, useRef, useEffect } from 'react'
import { THEMES, type ThemeId } from '../hooks/useTheme'

interface Props {
  themeId: ThemeId
  onSetTheme: (id: ThemeId) => void
}

export default function ThemeSwitcher({ themeId, onSetTheme }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = THEMES.find(t => t.id === themeId)!

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 h-8 transition-opacity hover:opacity-70"
        title="테마 변경" aria-label="테마 변경">
        <div className="w-[18px] h-[18px] rounded-[3px] overflow-hidden border flex-shrink-0"
          style={{ borderColor: 'var(--border-strong)' }}>
          <div className="w-full h-full flex">
            <div style={{ backgroundColor: current.bg, flex: 1 }} />
            <div style={{ backgroundColor: current.accent, width: '6px' }} />
          </div>
        </div>
        <svg width="9" height="5" viewBox="0 0 9 5" fill="none" style={{ color: 'var(--text-muted)' }}>
          <path d="M1 1l3.5 3L8 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 border shadow-xl z-50 py-1 min-w-[160px]"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px' }}>
          {THEMES.map(t => {
            const active = themeId === t.id
            return (
              <button key={t.id}
                onClick={() => { onSetTheme(t.id); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-[7px] text-[12px] transition-colors"
                style={{
                  backgroundColor: active ? 'var(--bg-raised)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-secondary)',
                }}>
                <div className="w-4 h-4 overflow-hidden flex-shrink-0 border"
                  style={{ borderColor: 'var(--border-strong)', borderRadius: '3px' }}>
                  <div className="w-full h-full flex">
                    <div style={{ backgroundColor: t.bg, flex: 1 }} />
                    <div style={{ backgroundColor: t.accent, width: '5px' }} />
                  </div>
                </div>
                <div className="flex flex-col items-start">
                  <span style={{ fontWeight: active ? 600 : 400 }}>{t.nameKo}</span>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
                </div>
                {active && (
                  <svg className="ml-auto flex-shrink-0" width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
