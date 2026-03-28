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
