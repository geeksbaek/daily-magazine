import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react'
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import type { Article } from '../types/magazine'
import { timeAgo } from '../utils/format'

// ─── Category SVG decorations ───────────────────────────────────────────
// Each category gets a unique decorative illustration

const CATEGORY_DECORATIONS: Record<string, { svg: ReactNode; color: string; bgColor: string }> = {
  ai: {
    color: '#7C3AED',
    bgColor: '#7C3AED10',
    svg: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Neural network / brain motif */}
        <circle cx="60" cy="35" r="12" stroke="#7C3AED" strokeWidth="1.5" opacity="0.7" />
        <circle cx="35" cy="65" r="10" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
        <circle cx="85" cy="65" r="10" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
        <circle cx="45" cy="95" r="8" stroke="#7C3AED" strokeWidth="1.5" opacity="0.3" />
        <circle cx="75" cy="95" r="8" stroke="#7C3AED" strokeWidth="1.5" opacity="0.3" />
        <line x1="60" y1="47" x2="38" y2="57" stroke="#7C3AED" strokeWidth="1" opacity="0.4" />
        <line x1="60" y1="47" x2="82" y2="57" stroke="#7C3AED" strokeWidth="1" opacity="0.4" />
        <line x1="35" y1="75" x2="45" y2="87" stroke="#7C3AED" strokeWidth="1" opacity="0.3" />
        <line x1="85" y1="75" x2="75" y2="87" stroke="#7C3AED" strokeWidth="1" opacity="0.3" />
        <line x1="35" y1="75" x2="75" y2="87" stroke="#7C3AED" strokeWidth="0.5" opacity="0.2" />
        <line x1="85" y1="75" x2="45" y2="87" stroke="#7C3AED" strokeWidth="0.5" opacity="0.2" />
        {/* Pulsing dots at nodes */}
        <circle cx="60" cy="35" r="3" fill="#7C3AED" opacity="0.8" />
        <circle cx="35" cy="65" r="2.5" fill="#7C3AED" opacity="0.6" />
        <circle cx="85" cy="65" r="2.5" fill="#7C3AED" opacity="0.6" />
      </svg>
    ),
  },
  dev_tools: {
    color: '#059669',
    bgColor: '#05966910',
    svg: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Code/terminal motif */}
        <rect x="15" y="20" width="90" height="65" rx="4" stroke="#059669" strokeWidth="1.5" opacity="0.5" />
        <line x1="15" y1="34" x2="105" y2="34" stroke="#059669" strokeWidth="1" opacity="0.3" />
        <circle cx="25" cy="27" r="2" fill="#EF4444" opacity="0.6" />
        <circle cx="33" cy="27" r="2" fill="#F59E0B" opacity="0.6" />
        <circle cx="41" cy="27" r="2" fill="#10B981" opacity="0.6" />
        {/* Code lines */}
        <line x1="25" y1="44" x2="38" y2="44" stroke="#059669" strokeWidth="1.5" opacity="0.6" />
        <line x1="42" y1="44" x2="72" y2="44" stroke="#059669" strokeWidth="1.5" opacity="0.3" />
        <line x1="30" y1="54" x2="60" y2="54" stroke="#059669" strokeWidth="1.5" opacity="0.4" />
        <line x1="64" y1="54" x2="80" y2="54" stroke="#059669" strokeWidth="1.5" opacity="0.2" />
        <line x1="30" y1="64" x2="50" y2="64" stroke="#059669" strokeWidth="1.5" opacity="0.5" />
        <line x1="25" y1="74" x2="55" y2="74" stroke="#059669" strokeWidth="1.5" opacity="0.3" />
        {/* Cursor blink */}
        <rect x="58" y="70" width="2" height="10" fill="#059669" opacity="0.8" />
        {/* Gear */}
        <circle cx="90" cy="100" r="12" stroke="#059669" strokeWidth="1" opacity="0.3" />
        <circle cx="90" cy="100" r="5" stroke="#059669" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
  },
  big_tech: {
    color: '#0369A1',
    bgColor: '#0369A110',
    svg: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Building/enterprise motif */}
        <rect x="35" y="25" width="50" height="75" rx="2" stroke="#0369A1" strokeWidth="1.5" opacity="0.5" />
        <rect x="20" y="50" width="20" height="50" rx="2" stroke="#0369A1" strokeWidth="1" opacity="0.3" />
        <rect x="80" y="40" width="22" height="60" rx="2" stroke="#0369A1" strokeWidth="1" opacity="0.3" />
        {/* Windows */}
        {[0, 1, 2, 3, 4].map(row =>
          [0, 1, 2].map(col => (
            <rect
              key={`${row}-${col}`}
              x={42 + col * 14}
              y={32 + row * 13}
              width="8"
              height="7"
              fill="#0369A1"
              opacity={0.15 + Math.random() * 0.2}
            />
          ))
        )}
        {/* Signal waves */}
        <path d="M60 18 Q65 10 70 18" stroke="#0369A1" strokeWidth="1" opacity="0.4" fill="none" />
        <path d="M57 14 Q65 3 73 14" stroke="#0369A1" strokeWidth="1" opacity="0.25" fill="none" />
      </svg>
    ),
  },
  quick_bites: {
    color: '#DC2626',
    bgColor: '#DC262610',
    svg: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Lightning / quick motif */}
        <path d="M65 15 L50 55 H65 L48 105 L80 50 H62 L78 15 Z" stroke="#DC2626" strokeWidth="1.5" opacity="0.5" fill="#DC262608" />
        <circle cx="30" cy="30" r="3" fill="#DC2626" opacity="0.3" />
        <circle cx="95" cy="80" r="4" fill="#DC2626" opacity="0.2" />
        <circle cx="25" cy="90" r="2" fill="#DC2626" opacity="0.2" />
      </svg>
    ),
  },
}

function getDecoration(category: string) {
  return CATEGORY_DECORATIONS[category] || CATEGORY_DECORATIONS['quick_bites']
}

// ─── Drop Cap component ────────────────────────────────────────────────

function DropCap({ char, color }: { char: string; color: string }) {
  return (
    <span
      className="float-left font-serif font-bold leading-none mr-2 mt-1"
      style={{
        fontSize: '3.5rem',
        lineHeight: '0.8',
        color,
        opacity: 0.85,
      }}
    >
      {char}
    </span>
  )
}

// ─── Pretext-powered text measurement hook ─────────────────────────────

function usePretextMetrics(text: string, maxWidth: number, font: string, lineHeight: number) {
  const [metrics, setMetrics] = useState<{ height: number; lineCount: number; lines: string[] } | null>(null)

  useEffect(() => {
    if (!text || maxWidth <= 0) return
    try {
      const prepared = prepareWithSegments(text, font)
      const result = layoutWithLines(prepared, maxWidth, lineHeight)
      setMetrics({
        height: result.height,
        lineCount: result.lineCount,
        lines: result.lines.map(l => l.text),
      })
    } catch {
      // fallback if pretext fails
      setMetrics(null)
    }
  }, [text, maxWidth, font, lineHeight])

  return metrics
}

// ─── Main MagazineArticle component ────────────────────────────────────

interface MagazineArticleProps {
  article: Article
  variant?: 'featured' | 'standard' | 'compact'
  showDecoration?: boolean
}

export default function MagazineArticle({
  article,
  variant = 'featured',
  showDecoration = true,
}: MagazineArticleProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyWidth, setBodyWidth] = useState(0)
  const decoration = getDecoration(article.category)

  // Measure body container width for pretext
  const measureWidth = useCallback(() => {
    if (bodyRef.current) {
      setBodyWidth(bodyRef.current.clientWidth)
    }
  }, [])

  useEffect(() => {
    measureWidth()
    window.addEventListener('resize', measureWidth)
    return () => window.removeEventListener('resize', measureWidth)
  }, [measureWidth])

  // Use pretext to estimate text metrics
  const textContent = article.body || article.excerpt || (article as any).content || (article as any).summary || ""
  const pretextMetrics = usePretextMetrics(
    textContent,
    bodyWidth > 0 ? bodyWidth : 600,
    '15px DM Sans',
    22
  )

  const displayText = article.body || article.excerpt || (article as any).content || (article as any).summary || ""
  const firstChar = displayText.charAt(0)
  const restText = displayText.slice(1)

  if (variant === 'compact') {
    return <CompactMagazineCard article={article} decoration={decoration} />
  }

  const isFeatured = variant === 'featured'

  return (
    <article
      className={`group relative ${isFeatured ? 'mb-10' : 'mb-6'}`}
      style={{ color: 'var(--text)' }}
    >
      {/* Header: category tag + meta */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className="text-[10px] font-mono font-semibold tracking-widest uppercase px-2 py-0.5"
          style={{
            color: decoration.color,
            backgroundColor: decoration.bgColor,
            border: `1px solid ${decoration.color}25`,
          }}
        >
          {article.category.replace('_', '/')}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
          {article.source}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(article.publishedAt)}
        </span>
      </div>

      {/* Title */}
      <h3
        className={`font-serif font-bold leading-tight mb-4 ${
          isFeatured ? 'text-[26px] lg:text-[34px]' : 'text-[20px] lg:text-[24px]'
        }`}
        style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
      >
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-75 transition-opacity"
        >
          {article.title}
        </a>
      </h3>

      {/* Body with SVG decoration wrapping */}
      <div ref={bodyRef} className="relative">
        {/* Float SVG decoration — text wraps around it */}
        {showDecoration && (
          <div
            className="float-right ml-5 mb-3 hidden md:block"
            style={{
              width: isFeatured ? 140 : 110,
              height: isFeatured ? 140 : 110,
              shapeOutside: 'circle(50%)',
              shapeMargin: '12px',
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center p-4"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${decoration.color}15, ${decoration.color}05)`,
                border: `1px solid ${decoration.color}15`,
              }}
            >
              {decoration.svg}
            </div>
          </div>
        )}

        {/* Drop cap + body text */}
        <div
          className={`font-sans leading-relaxed ${
            isFeatured ? 'text-[15px] lg:text-[16px]' : 'text-[14px]'
          }`}
          style={{ color: 'var(--text-secondary)' }}
        >
          <DropCap char={firstChar} color={decoration.color} />
          <span>{restText}</span>
        </div>

        {/* Clear float */}
        <div className="clear-both" />
      </div>

      {/* Footer: read time + pretext line count (subtle) */}
      <div className="mt-4 flex items-center gap-3">
        {article.readTime && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px" style={{ backgroundColor: decoration.color, opacity: 0.4 }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {article.readTime}분 읽기
            </span>
          </div>
        )}
        {pretextMetrics && (
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
            {pretextMetrics.lineCount}L
          </span>
        )}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: decoration.color }}
        >
          원문 보기 →
        </a>
      </div>
    </article>
  )
}

// ─── Compact variant with side decoration ──────────────────────────────

function CompactMagazineCard({
  article,
  decoration,
}: {
  article: Article
  decoration: { svg: ReactNode; color: string; bgColor: string }
}) {
  const displayText = article.body || article.excerpt || (article as any).content || (article as any).summary || ""

  return (
    <article
      className="group flex gap-4 py-5 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Mini decoration */}
      <div
        className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center p-2 mt-1"
        style={{
          background: decoration.bgColor,
          border: `1px solid ${decoration.color}20`,
        }}
      >
        {decoration.svg}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-mono font-semibold tracking-widest uppercase px-1.5 py-0.5"
            style={{ color: decoration.color, backgroundColor: decoration.bgColor }}
          >
            {article.source}
          </span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(article.publishedAt)}
          </span>
        </div>

        <h4 className="font-serif font-semibold text-[15px] leading-snug mb-1.5">
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

        <p
          className="text-[13px] leading-relaxed font-sans"
          style={{ color: 'var(--text-secondary)' }}
        >
          {displayText}
        </p>
      </div>
    </article>
  )
}

// ─── Exported sub-components ───────────────────────────────────────────

export { DropCap, getDecoration, usePretextMetrics, CATEGORY_DECORATIONS }
