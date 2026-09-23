import type { QuotedTweet } from '../types/magazine'
import { formatClock, formatCount } from '../utils/format'

export type Platform = 'x' | 'threads'

interface Props {
  platform: Platform
  author: string
  handle: string
  content: string
  thread?: string[]
  context?: string
  retweetedBy?: string
  quoted?: QuotedTweet
  url: string
  publishedAt: string
  metrics?: { likes?: number; retweets?: number; replies?: number; views?: number }
}

function PlatformGlyph({ platform }: { platform: Platform }) {
  if (platform === 'x') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-label="X" role="img" fill="currentColor">
        <path d="M18.9 2H22l-7.2 8.3L23.3 22h-6.6l-5.2-6.8L5.6 22H2.4l7.7-8.8L1.6 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.3 3.9H5.4L17.7 20Z" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-label="Threads" role="img" fill="currentColor">
      <path d="M12.2 22c-2.9 0-5.2-1-6.8-2.9C4 17.3 3.2 14.9 3.2 12c0-2.9.8-5.3 2.3-7.1C7 3 9.3 2 12.2 2c2.7 0 4.8.8 6.4 2.4l-1.5 1.5c-1.2-1.2-2.8-1.8-4.9-1.8-2.2 0-4 .8-5.1 2.2C6 7.7 5.4 9.6 5.4 12c0 2.4.6 4.3 1.7 5.7 1.2 1.4 2.9 2.2 5.1 2.2 1.7 0 3.1-.4 4.1-1.3 1-.8 1.5-1.9 1.5-3.1 0-1.1-.4-1.9-1.1-2.5-.2 2.4-1.7 3.8-4.1 3.8-1.1 0-2-.3-2.8-.9-.8-.6-1.2-1.4-1.2-2.4 0-1.1.4-1.9 1.3-2.5.8-.6 1.9-.9 3.3-.9.7 0 1.4.1 2.2.2-.2-1.4-.9-2.1-2.3-2.1-1 0-1.7.4-2.2 1.1l-1.8-1c.9-1.4 2.3-2.1 4-2.1 2.7 0 4.2 1.5 4.5 4.5 1.9 1 2.8 2.5 2.8 4.7 0 1.9-.7 3.4-2.1 4.6-1.4 1.2-3.3 1.8-5.6 1.8Zm.1-9.3c-1.6 0-2.5.5-2.5 1.4 0 .4.2.7.6 1 .4.3.9.4 1.4.4 1.4 0 2.1-.8 2.3-2.4-.6-.2-1.2-.3-1.8-.3Z" />
    </svg>
  )
}

function initials(name: string) {
  const t = name.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return t.slice(0, /^[A-Za-z]/.test(t) ? 2 : 1).toUpperCase()
}

/** A social post styled as a real quotation: speaker, words, then the editor's context. */
export default function SocialQuote(p: Props) {
  const m = p.metrics
  const stats: string[] = []
  if (m?.likes) stats.push(`좋아요 ${formatCount(m.likes)}`)
  if (m?.retweets) stats.push(`${p.platform === 'x' ? '리포스트' : '공유'} ${formatCount(m.retweets)}`)
  if (m?.replies) stats.push(`답글 ${formatCount(m.replies)}`)
  if (m?.views) stats.push(`조회 ${formatCount(m.views)}`)

  return (
    <figure data-part="quote" className="border-b border-rule py-6 last:border-b-0 last:pb-0">
      {p.retweetedBy && (
        <p className="mb-2.5 text-[12.5px] text-ink-3">@{p.retweetedBy.replace(/^@/, '')} 님이 리포스트</p>
      )}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-3 font-display text-[13px] font-bold text-ink-2"
        >
          {initials(p.author)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-semibold text-ink">{p.author}</div>
          <div className="truncate text-[12.5px] text-ink-3">@{p.handle.replace(/^@/, '')}</div>
        </div>
        <span className="text-ink-3"><PlatformGlyph platform={p.platform} /></span>
      </div>

      <blockquote className="mt-4 font-display text-[17px] font-medium leading-[1.75] text-ink">
        <p>{p.content}</p>
        {p.thread && p.thread.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-rule-2 pl-4 text-[15.5px] font-normal leading-[1.7] text-ink-2">
            {p.thread.map((t, i) => <p key={i}>{t}</p>)}
          </div>
        )}
      </blockquote>

      {p.quoted && (
        <div className="mt-4 border border-rule bg-paper-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className="font-semibold text-ink">{p.quoted.author}</span>
            <span className="text-ink-3">@{p.quoted.handle.replace(/^@/, '')}</span>
          </div>
          <p className="mt-1.5 text-[14.5px] leading-[1.65] text-ink-2">{p.quoted.content}</p>
          {p.quoted.url && (
            <a href={p.quoted.url} target="_blank" rel="noopener noreferrer" className="link-ink mt-2 inline-block text-[12.5px] text-ink-3">
              인용된 글 보기
            </a>
          )}
        </div>
      )}

      {p.context && (
        <p className="mt-4 text-[14px] leading-[1.7] text-ink-2">
          <span className="mr-1.5 font-semibold text-ink">맥락</span>
          {p.context}
        </p>
      )}

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3 tabular">
        {stats.map(s => <span key={s}>{s}</span>)}
        <span>{formatClock(p.publishedAt)}</span>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="link-ink text-ink-2">
          원문 보기
        </a>
      </figcaption>
    </figure>
  )
}
