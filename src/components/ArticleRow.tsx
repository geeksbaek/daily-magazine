import type { Article } from '../types/magazine'
import SourceLine from './SourceLine'
import ArticleBody from './ArticleBody'
import Marked from './Marked'

interface Props {
  article: Article
}

/** One article in a section list: dateline column, headline, excerpt, "본문 읽기" reader. */
export default function ArticleRow({ article }: Props) {
  return (
    <article data-part="article" className="border-b border-rule py-7 first:pt-0 last:border-b-0 last:pb-0 md:grid md:grid-cols-[150px_minmax(0,1fr)] md:gap-x-8">
      <SourceLine article={article} className="mb-2 md:mb-0 md:flex-col md:items-start md:gap-y-1.5 md:pt-1.5" />
      <div className="min-w-0">
        <h3 data-part="article-title" className="font-display text-[21px] font-semibold leading-[1.4] tracking-[-0.005em] text-ink md:text-[22px]">
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="title-link">
            {article.title}
          </a>
        </h3>
        <p className="mt-2.5 max-w-prose text-[15.5px] leading-[1.7] text-ink-2"><Marked text={article.excerpt} /></p>
        <ArticleBody article={article} />
      </div>
    </article>
  )
}
