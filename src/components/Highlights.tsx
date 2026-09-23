import type { Article } from '../types/magazine'
import SectionShell from './SectionShell'
import SourceLine from './SourceLine'
import ArticleBody from './ArticleBody'

interface Props {
  articles: Article[]
}

/** Lead story large on the left, the rest stacked on the right. */
export default function Highlights({ articles }: Props) {
  if (!articles || articles.length === 0) return null
  const [lead, ...rest] = articles

  return (
    <SectionShell id="highlights" title="오늘의 주요 기사" subtitle="Highlights" count={articles.length}>
      <div className={rest.length > 0 ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-14' : ''}>
        <article data-part="lead" className="min-w-0">
          <h3 data-part="lead-title" className="font-display text-[28px] font-bold leading-[1.3] tracking-[-0.01em] text-ink sm:text-[34px] lg:text-[36px]">
            <a href={lead.url} target="_blank" rel="noopener noreferrer" className="title-link">
              {lead.title}
            </a>
          </h3>
          <p className="mt-5 max-w-prose text-[17px] leading-[1.75] text-ink-2">{lead.excerpt}</p>
          <SourceLine article={lead} className="mt-4" />
          <ArticleBody article={lead} size="lg" />
        </article>

        {rest.length > 0 && (
          <div className="mt-10 border-t border-rule-2 lg:mt-0 lg:border-t-0 lg:border-l lg:border-rule lg:pl-10">
            {rest.map(a => (
              <article key={a.id} data-part="highlight" className="border-b border-rule py-5 first:pt-5 last:border-b-0 last:pb-0 lg:first:pt-0">
                <h4 className="font-display text-[19px] font-semibold leading-[1.4] text-ink">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="title-link">
                    {a.title}
                  </a>
                </h4>
                <p className="clamp-3 mt-2 text-[14.5px] leading-[1.65] text-ink-2">{a.excerpt}</p>
                <SourceLine article={a} className="mt-2.5" showTime={false} />
                <ArticleBody article={a} />
              </article>
            ))}
          </div>
        )}
      </div>
    </SectionShell>
  )
}
