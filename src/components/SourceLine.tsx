import type { Article } from '../types/magazine'
import { formatClock } from '../utils/format'

interface Props {
  article: Pick<Article, 'source' | 'publisher' | 'tier' | 'publishedAt' | 'readTime'>
  className?: string
  showTime?: boolean
}

export function TierMark({ tier }: { tier?: number }) {
  if (tier !== 1) return null
  return (
    <span
      className="inline-flex items-center rounded-[3px] bg-mark px-1.5 py-[1px] text-[11px] font-semibold leading-[16px] text-mark-ink"
      title="공식 발표·원문 등 1차 출처"
    >
      1차 출처
    </span>
  )
}

/** Source, publisher, tier, and time — the dateline under each article. */
export default function SourceLine({ article, className = '', showTime = true }: Props) {
  const publisher = article.publisher && article.publisher !== article.source ? article.publisher : null
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3 ${className}`}>
      <span className="font-medium text-ink-2">{publisher ?? article.source}</span>
      {publisher && <span>{article.source} 경유</span>}
      <TierMark tier={article.tier} />
      {showTime && article.publishedAt && (
        <span className="tabular">{formatClock(article.publishedAt)}</span>
      )}
      {article.readTime ? <span className="tabular">{article.readTime}분</span> : null}
    </div>
  )
}
