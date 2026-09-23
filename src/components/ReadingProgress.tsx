import type { SectionLink } from './MagazineNav'
import { formatIssueDate } from '../utils/format'

interface Props {
  issueNumber: number
  date: string
  sections: SectionLink[]
  pct: number
  active: string
  onJump: (id: string) => void
}

/**
 * Scroll progress for the whole issue.
 * Wide screens: a fixed left rail (issue title, section tree with the current section marked,
 * a patterned progress bar with a percentage). Narrow screens: the nav carries a hairline bar and the percentage (see MagazineNav).
 */
export default function ReadingProgress({ issueNumber, date, sections, pct, active, onJump }: Props) {
  return (
    <>
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
