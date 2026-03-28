import type { Article } from '../types/magazine'
import { timeAgo } from '../utils/format'

const GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
  'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
  'linear-gradient(135deg, #200122 0%, #6f0000 100%)',
  'linear-gradient(135deg, #093028 0%, #237a57 100%)',
  'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)',
  'linear-gradient(135deg, #0d0d0d 0%, #1c3a5e 100%)',
  'linear-gradient(135deg, #3a0000 0%, #1a0a00 100%)',
]

interface FeaturedProps {
  article: Article
  size?: 'large' | 'medium'
}

export function FeaturedCard({ article, size = 'large' }: FeaturedProps) {
  const gradient = GRADIENTS[article.imageGradient ?? 0]
  const isLarge = size === 'large'

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full"
    >
      {/* Image area */}
      <div
        className={`w-full ${isLarge ? 'h-52 lg:h-72' : 'h-36 lg:h-48'} mb-4 overflow-hidden`}
        style={{ background: gradient }}
      >
        <div className="w-full h-full flex items-end p-4">
          <span
            className="text-[10px] font-mono tracking-widest px-2 py-0.5 text-white/70"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', letterSpacing: '0.2em' }}
          >
            {article.source.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="section-tag">{article.category}</span>
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
            {timeAgo(article.publishedAt)}
          </span>
        </div>
        <h3
          className={`font-serif font-bold leading-tight group-hover:opacity-70 transition-opacity ${isLarge ? 'text-[22px] lg:text-[28px]' : 'text-[18px] lg:text-[22px]'}`}
          style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
        >
          {article.title}
        </h3>
        <p
          className={`mt-2 leading-relaxed font-sans ${isLarge ? 'text-[14px] lg:text-[15px]' : 'text-[13px]'}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          {article.excerpt}
        </p>
        {article.readTime && (
          <div className="mt-3 flex items-center gap-1">
            <div className="w-4 h-px" style={{ backgroundColor: 'var(--border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {article.readTime}분 읽기
            </span>
          </div>
        )}
      </div>
    </a>
  )
}

interface StandardProps {
  article: Article
  showImage?: boolean
}

export function StandardCard({ article, showImage = true }: StandardProps) {
  const gradient = GRADIENTS[article.imageGradient ?? 0]

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 py-4 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {showImage && (
        <div
          className="w-20 h-16 shrink-0"
          style={{ background: gradient }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="section-tag">{article.source}</span>
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
            {timeAgo(article.publishedAt)}
          </span>
        </div>
        <h4
          className="font-serif font-semibold text-[15px] leading-snug group-hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
        >
          {article.title}
        </h4>
        <p
          className="mt-1 text-[12px] leading-relaxed line-clamp-2 font-sans"
          style={{ color: 'var(--text-secondary)' }}
        >
          {article.excerpt}
        </p>
      </div>
    </a>
  )
}

interface CompactProps {
  article: Article
  index: number
}

export function CompactCard({ article, index }: CompactProps) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 py-4 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <span
        className="font-mono text-[11px] pt-0.5 shrink-0 w-5"
        style={{ color: 'var(--text-muted)' }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <h4
          className="font-sans font-medium text-[14px] leading-snug group-hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text)' }}
        >
          {article.title}
        </h4>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="section-tag">{article.source}</span>
          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
            {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
      >
        <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  )
}
