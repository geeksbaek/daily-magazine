interface Props {
  number: string
  title: string
  subtitle?: string
  color?: string
}

export default function SectionHeader({ number, title, subtitle, color }: Props) {
  return (
    <div className="mb-8 lg:mb-10">
      <div className="flex items-center gap-4 mb-3">
        <span
          className="font-mono text-[11px] tracking-[0.25em] font-medium"
          style={{ color: color || 'var(--accent)' }}
        >
          {number}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-strong)' }} />
        {subtitle && (
          <span
            className="font-mono text-[10px] tracking-widest hidden md:block"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.2em' }}
          >
            {subtitle}
          </span>
        )}
      </div>
      <h2
        className="font-serif font-bold leading-none"
        style={{
          color: 'var(--text)',
          fontSize: 'clamp(28px, 4vw, 48px)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
    </div>
  )
}
