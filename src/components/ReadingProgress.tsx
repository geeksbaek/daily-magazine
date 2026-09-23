import { useEffect, useState } from 'react'
import type { SectionLink } from './MagazineNav'
import { formatIssueDate } from '../utils/format'

interface Props {
  issueNumber: number
  date: string
  sections: SectionLink[]
  onJump: (id: string) => void
}

const NAV_OFFSET = 120

/**
 * Scroll progress for the whole issue.
 * Wide screens: a fixed left rail (issue title, section tree with the current section marked,
 * a patterned progress bar with a percentage). Narrow screens: a hairline bar under the nav.
 */
export default function ReadingProgress({ issueNumber, date, sections, onJump }: Props) {
  const [pct, setPct] = useState(0)
  const [active, setActive] = useState('')

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      setPct(max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0)
      let current = ''
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET) current = s.id
      }
      setActive(current)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // expanding/collapsing article bodies changes the page height without scrolling
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [sections])

  return (
    <>
      <div className="progress-line" aria-hidden="true" style={{ transform: `scaleX(${pct / 100})` }} />

      <aside className="progress-rail" aria-label="읽기 진행">
        <p className="progress-rail__title">
          제{issueNumber}호
          <span>{formatIssueDate(date)}</span>
        </p>

        <p className="progress-rail__label">목차</p>
        <ol className="progress-rail__tree">
          {sections.map(s => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                aria-current={active === s.id ? 'location' : undefined}
                data-active={active === s.id}
              >
                <span aria-hidden="true" className="progress-rail__glyph">└</span>
                <span className="min-w-0 truncate">{s.label}</span>
                <span className="progress-rail__count">{s.count}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="progress-rail__meter">
          <div
            className="progress-rail__bar"
            role="progressbar"
            aria-label="이번 호를 읽은 정도"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="progress-rail__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-rail__pct">{pct}%</span>
        </div>
        <p className="progress-rail__hint">↑ / ↓ 키로 스크롤</p>
      </aside>
    </>
  )
}
