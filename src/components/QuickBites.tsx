import type { Article } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { timeAgo } from '../utils/format'

interface Props {
  articles: Article[]
}

// Category color mapping for accent
const CATEGORY_COLORS: Record<string, string> = {
  ai: '#7C3AED',
  dev_tools: '#059669',
  big_tech: '#0369A1',
  quick_bites: '#F59E0B',
}

function QuickBiteCard({ article, index }: { article: Article; index: number }) {
  const color = CATEGORY_COLORS[article.category] || '#F59E0B'
  const displayText = article.body || article.excerpt

  return (
    <article
      className="group py-5 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Top row: number + title */}
      <div className="flex items-start gap-3">
        <span
          className="font-mono text-[20px] font-bold shrink-0 leading-none mt-0.5"
          style={{ color, opacity: 0.35 }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="font-serif font-semibold text-[15px] leading-snug mb-2">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text)' }}
            >
              {article.title}
            </a>
          </h4>

          {/* Body / excerpt text */}
          <p
            className="text-[13px] leading-relaxed font-sans mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {displayText}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-mono font-semibold tracking-widest uppercase px-1.5 py-0.5"
              style={{
                color,
                backgroundColor: `${color}10`,
                border: `1px solid ${color}20`,
              }}
            >
              {article.source}
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {timeAgo(article.publishedAt)}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color }}
            >
              원문 →
            </a>
          </div>
        </div>
      </div>
    </article>
  )
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
          number="08"
          title="Quick Bites"
          subtitle="간략 뉴스 요약"
          color="#F59E0B"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-10">
          <div className="border-b lg:border-b-0 lg:border-r pb-0 lg:pr-10" style={{ borderColor: 'var(--border)' }}>
            {left.map((article, i) => (
              <QuickBiteCard key={article.id} article={article} index={i + 1} />
            ))}
          </div>
          <div className="pt-0 lg:pt-0">
            {right.map((article, i) => (
              <QuickBiteCard key={article.id} article={article} index={left.length + i + 1} />
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
