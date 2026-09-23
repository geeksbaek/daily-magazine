import type { ReactNode } from 'react'

interface Props {
  id: string
  title: string
  subtitle?: string
  count?: number
  unit?: string
  children: ReactNode
  /** Rendered under the count in the rail (desktop) / after the header (mobile). */
  aside?: ReactNode
}

/**
 * Section frame with a running head: on desktop the section name sits in a
 * sticky left rail, like a magazine's running header; on mobile it stacks.
 * Returns null-friendly: callers should skip rendering when count is 0.
 */
export default function SectionShell({ id, title, subtitle, count, unit = '편', children, aside }: Props) {
  return (
    <section id={id} data-part="section" className="scroll-mt-16 border-t border-rule-2">
      <div className="wrap py-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-14">
          <header data-part="section-head" className="mb-8 lg:mb-0 lg:sticky lg:top-20 lg:self-start">
            <h2 data-part="section-title" className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p>
            )}
            {typeof count === 'number' && (
              <p className="mt-4 text-[13px] text-ink-2 tabular">
                {count}{unit}
              </p>
            )}
            {aside && <div className="mt-4">{aside}</div>}
          </header>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </section>
  )
}
