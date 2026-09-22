import type { Magazine } from '../types/magazine'
import { issueParts, formatIssueNo } from '../utils/format'
import type { SectionLink } from './MagazineNav'

interface Props {
  magazine: Magazine
  contents: SectionLink[]
  onReadIssue: () => void
  onJump: (id: string) => void
}

/**
 * The cover is a tear-off calendar leaf: the day numeral is the masthead,
 * the issue's lead headline sits beside it, and a perforation closes the leaf.
 */
export default function Cover({ magazine, contents, onReadIssue, onJump }: Props) {
  const { year, month, day, weekday } = issueParts(magazine.date)
  const { cover } = magazine

  return (
    <section id="cover" className="wrap pt-[76px] sm:pt-[88px]">
      <div className="grid gap-y-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-x-16">
        {/* Calendar leaf */}
        <div className="flex gap-6 lg:block">
          <div
            className="w-full max-w-[300px] shrink-0 border border-rule bg-paper-2 sm:w-[200px] lg:w-full"
            style={{ containerType: 'inline-size' }}
          >
            <div className="leaf-binding" />
            <div className="px-5 pb-5 pt-4 sm:px-6">
              <p className="text-[13px] text-ink-2 tabular">{year}년 {month}월</p>
              <p
                className="whitespace-nowrap font-display font-extrabold leading-[0.95] text-ink tabular"
                // sized by the leaf's own width (container query units) so it never spills out of the card
                style={{ fontSize: 'clamp(80px, 60cqw, 168px)', letterSpacing: '-0.05em' }}
              >
                {day}
              </p>
              <div className="mt-3 flex items-baseline justify-between border-t border-rule-2 pt-3 text-[14px]">
                <span className="font-semibold text-ink">{weekday}</span>
                <span className="text-accent tabular">{formatIssueNo(magazine.issueNumber)}</span>
              </div>
            </div>
          </div>

          {/* Contents */}
          <nav aria-label="목차" className="hidden min-w-0 flex-1 sm:block lg:mt-6">
            <p className="text-[13px] text-ink-3">이번 호에 실린 것</p>
            <ul className="mt-2 border-t border-rule">
              {contents.map(c => (
                <li key={c.id} className="border-b border-rule">
                  <button
                    type="button"
                    onClick={() => onJump(c.id)}
                    className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-[13.5px] text-ink hover:text-accent"
                  >
                    <span>{c.label}</span>
                    <span className="text-ink-3 tabular">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Lead */}
        <div className="min-w-0 lg:pt-2">
          <h1
            className="font-display font-bold leading-[1.22] tracking-[-0.015em] text-ink"
            style={{ fontSize: 'clamp(28px, 4.4vw, 54px)' }}
          >
            {cover.mainHeadline}
          </h1>
          <p className="mt-6 max-w-prose text-[17px] leading-[1.75] text-ink-2 sm:text-[18px]">
            {cover.mainExcerpt}
          </p>

          {cover.headlines.length > 0 && (
            <ul className="mt-9 border-t border-rule-2">
              {cover.headlines.map((h, i) => (
                <li key={i} className="border-b border-rule py-3.5 font-display text-[17px] font-semibold leading-[1.45] text-ink sm:text-[18px]">
                  {h}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={onReadIssue}
            className="mt-8 inline-flex h-11 items-center bg-ink px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-accent hover:text-accent-ink"
          >
            이번 호 읽기
          </button>
        </div>
      </div>

      <div className="perforation mt-12 lg:mt-16" aria-hidden="true" />
    </section>
  )
}
