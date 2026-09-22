import type { ArchiveEntry } from '../types/magazine'
import { issueParts, formatIssueNo } from '../utils/format'

interface Props {
  issues: ArchiveEntry[]
  currentDate: string
  onSelectIssue: (date: string) => void
}

/** Past issues as a stack of small calendar leaves. */
export default function Archive({ issues, currentDate, onSelectIssue }: Props) {
  return (
    <section className="wrap min-h-screen pt-[88px] pb-24">
      <header className="border-b border-rule-2 pb-8">
        <h1 className="font-display text-[36px] font-bold leading-tight tracking-[-0.01em] text-ink sm:text-[44px]">
          지난 호
        </h1>
        <p className="mt-2 text-[14px] text-ink-2 tabular">
          {issues.length}개 호. 매일 아침 6시에 새 호가 나옵니다.
        </p>
      </header>

      <ul>
        {issues.map(issue => {
          const { year, month, day, weekday } = issueParts(issue.date)
          const isCurrent = issue.date === currentDate
          return (
            <li key={issue.date} className="border-b border-rule">
              <button
                type="button"
                onClick={() => onSelectIssue(issue.date)}
                className="group grid w-full grid-cols-[72px_minmax(0,1fr)] gap-x-5 py-6 text-left sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-8"
                aria-current={isCurrent ? 'page' : undefined}
              >
                <div className="border border-rule bg-paper-2 px-2 pb-2 pt-1.5 text-center">
                  <div className="text-[11px] text-ink-3 tabular">{year}.{String(month).padStart(2, '0')}</div>
                  <div className="font-display text-[34px] font-extrabold leading-none text-ink tabular sm:text-[44px]" style={{ letterSpacing: '-0.04em' }}>
                    {day}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-2">{weekday.slice(0, 1)}</div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 text-[12.5px] tabular">
                    <span className="text-accent">{formatIssueNo(issue.issueNumber)}</span>
                    {isCurrent && <span className="text-ink-3">지금 보는 호</span>}
                  </div>
                  <h2 className="mt-1.5 font-display text-[19px] font-semibold leading-[1.4] text-ink transition-colors group-hover:text-accent sm:text-[22px]">
                    {issue.mainHeadline}
                  </h2>
                  {issue.headlines.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-[14px] leading-[1.55] text-ink-2">
                      {issue.headlines.map((h, i) => (
                        <li key={i} className="flex gap-2">
                          <span aria-hidden="true" className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-3" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
