import type { Article } from '../types/magazine'
import SectionShell from './SectionShell'
import SourceLine from './SourceLine'
import ArticleBody from './ArticleBody'

interface Props {
  articles: Article[]
}

/** Short items in two columns; each is a headline, one line of context, and the dateline. */
export default function QuickBites({ articles }: Props) {
  if (!articles || articles.length === 0) return null
  return (
    <SectionShell id="quick-bites" title="짧게 읽기" subtitle="Quick bites" count={articles.length}>
      <div className="cols-2 -mt-5">
        {articles.map(a => (
          <article key={a.id} className="border-b border-rule py-5 last:border-b-0 last:pb-0">
            <h3 className="font-display text-[17.5px] font-semibold leading-[1.45] text-ink">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="title-link">
                {a.title}
              </a>
            </h3>
            <p className="mt-2 text-[14px] leading-[1.65] text-ink-2">{a.excerpt}</p>
            <SourceLine article={a} className="mt-2.5" showTime={false} />
            <ArticleBody article={a} />
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
