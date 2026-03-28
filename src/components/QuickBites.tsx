import type { Article } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { CompactCard } from './ArticleCard'

interface Props {
  articles: Article[]
}

export default function QuickBites({ articles }: Props) {
  const half = Math.ceil(articles.length / 2)
  const left = articles.slice(0, half)
  const right = articles.slice(half)

  return (
    <section
      id="quick-bites"
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: 'var(--bg-raised)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number="06"
          title="Quick Bites"
          subtitle="간략 뉴스 요약"
          color="#F59E0B"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-10">
          <div className="border-b lg:border-b-0 lg:border-r pb-0 lg:pr-10" style={{ borderColor: 'var(--border)' }}>
            {left.map((article, i) => (
              <CompactCard key={article.id} article={article} index={i + 1} />
            ))}
          </div>
          <div className="pt-0 lg:pt-0">
            {right.map((article, i) => (
              <CompactCard key={article.id} article={article} index={left.length + i + 1} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-12 pt-8 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="font-serif font-black text-[18px] sm:text-[20px] tracking-[-0.02em]"
              style={{ color: 'var(--text)' }}
            >
              GEEK<span style={{ color: 'var(--accent)' }}>/</span>DAILY
            </span>
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              매일 아침 6시 업데이트
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              RSS 40개 · X 21개 계정
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
