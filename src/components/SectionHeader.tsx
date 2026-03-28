import { useThemeId } from '../hooks/useTheme'

interface Props {
  number: string
  title: string
  subtitle?: string
  color?: string
}

export default function SectionHeader({ number, title, subtitle, color }: Props) {
  const themeId = useThemeId()

  /* ── Terminal: ASCII divider ── */
  if (themeId === 'terminal') {
    const line = '═'.repeat(Math.max(8, 40 - title.length))
    return (
      <div className="mb-8 lg:mb-10 font-mono" style={{ color: 'var(--accent)' }}>
        <div className="text-[13px]" style={{ opacity: 0.4 }}>
          {'═══ '}{number}{' :: '}{title}{' '}{line}
        </div>
        {subtitle && (
          <div className="text-[11px] mt-1" style={{ opacity: 0.25 }}>{'    # '}{subtitle}</div>
        )}
      </div>
    )
  }

  /* ── Brutalist: oversized, stark ── */
  if (themeId === 'brutalist') {
    return (
      <div className="mb-8 lg:mb-10">
        <div className="flex items-end gap-3 pb-3 mb-3" style={{ borderBottom: '4px solid var(--text)' }}>
          <span style={{
            fontSize: 'clamp(48px, 6vw, 80px)',
            fontWeight: 900,
            lineHeight: 0.85,
            color: 'var(--accent)',
            fontFamily: 'Impact, "Arial Black", sans-serif',
          }}>
            {number}
          </span>
          <h2 style={{
            fontSize: 'clamp(24px, 3vw, 40px)',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text)',
            fontFamily: 'Impact, "Arial Black", sans-serif',
            lineHeight: 1,
          }}>
            {title}
          </h2>
        </div>
      </div>
    )
  }

  /* ── Broadsheet: thin rule, small caps ── */
  if (themeId === 'broadsheet') {
    return (
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-2" style={{ borderBottom: '1px solid var(--border-strong)', paddingBottom: '6px' }}>
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{number}</span>
          <h2 className="font-serif font-bold text-[18px] lg:text-[22px]" style={{ color: 'var(--text)', letterSpacing: '0.03em' }}>{title}</h2>
          {subtitle && <span className="font-serif italic text-[11px] ml-auto hidden md:block" style={{ color: 'var(--text-muted)' }}>{subtitle}</span>}
        </div>
      </div>
    )
  }

  /* ── Dashboard: glowing badge ── */
  if (themeId === 'dashboard') {
    return (
      <div className="mb-8 lg:mb-10">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-[10px] px-2.5 py-1" style={{
            backgroundColor: 'rgba(0,212,255,0.08)',
            color: 'var(--accent)',
            borderRadius: '99px',
            border: '1px solid rgba(0,212,255,0.15)',
          }}>
            {number}
          </span>
          {subtitle && <span className="font-mono text-[10px] tracking-widest hidden md:block" style={{ color: 'var(--text-muted)' }}>{subtitle}</span>}
        </div>
        <h2 className="font-sans font-bold leading-none" style={{
          color: 'var(--text)',
          fontSize: 'clamp(24px, 3vw, 40px)',
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
      </div>
    )
  }

  /* ── Editorial (default) ── */
  return (
    <div className="mb-8 lg:mb-10">
      <div className="flex items-center gap-4 mb-3">
        <span className="font-mono text-[11px] tracking-[0.25em] font-medium" style={{ color: color || 'var(--accent)' }}>{number}</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-strong)' }} />
        {subtitle && <span className="font-mono text-[10px] tracking-widest hidden md:block" style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}>{subtitle}</span>}
      </div>
      <h2 className="font-serif font-bold leading-none" style={{
        color: 'var(--text)',
        fontSize: 'clamp(28px, 4vw, 48px)',
        letterSpacing: '-0.02em',
      }}>
        {title}
      </h2>
    </div>
  )
}
