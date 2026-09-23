import { useEffect, useId, useRef, useState } from 'react'
import { DESIGNS } from '../designs/registry'

interface Props {
  designId: string
  onSetDesign: (id: string) => void
}

/** Popover list of the available designs, each with a three-colour swatch. */
export default function DesignSwitcher({ designId, onSetDesign }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (DESIGNS.length < 2) return null
  const current = DESIGNS.find(d => d.id === designId) ?? DESIGNS[0]

  return (
    <div ref={ref} className="relative" data-part="design-switcher">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`디자인 바꾸기, 현재 ${current.name}`}
        title={`디자인: ${current.name}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="1.75" y="1.75" width="5.5" height="5.5" rx="1" />
          <rect x="8.75" y="1.75" width="5.5" height="5.5" rx="2.75" />
          <rect x="1.75" y="8.75" width="5.5" height="5.5" rx="2.75" />
          <rect x="8.75" y="8.75" width="5.5" height="5.5" rx="1" />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="디자인"
          className="absolute right-0 top-11 z-50 w-[272px] max-w-[calc(100vw-32px)] border border-rule bg-paper p-1.5 shadow-lg"
        >
          {DESIGNS.map(d => {
            const selected = d.id === designId
            return (
              <li key={d.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => { onSetDesign(d.id); setOpen(false) }}
                  className="flex w-full items-start gap-3 px-2.5 py-2 text-left transition-colors hover:bg-paper-2"
                >
                  <span className="mt-0.5 flex shrink-0 overflow-hidden rounded-full border border-rule" aria-hidden="true">
                    {d.swatch.slice(0, 3).map((c, i) => (
                      <span key={i} className="block h-5 w-2.5" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink" style={{ color: selected ? 'var(--accent)' : undefined }}>
                      {d.name}{selected ? ' ✓' : ''}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{d.description}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
