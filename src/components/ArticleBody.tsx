import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Article } from '../types/magazine'
import { paragraphs } from '../utils/format'

interface Props {
  article: Article
  /** Larger type for the lead story. */
  size?: 'md' | 'lg'
}

/**
 * Expandable long-form body. Collapsed shows a single "본문 읽기" control;
 * open shows paragraphs at reading size plus links to the original and,
 * for Hacker News items, the discussion.
 */
export default function ArticleBody({ article, size = 'md' }: Props) {
  const [open, setOpen] = useState(false)
  // collapsing is instant (no height animation) so the page never slides under the reader
  const [animate, setAnimate] = useState(true)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  const expand = () => { setAnimate(true); setOpen(true) }
  /** Close, then keep the toggle button exactly where it was on screen (or bring it back under the nav). */
  const collapse = () => {
    const btn = toggleRef.current
    const before = btn?.getBoundingClientRect().top ?? 0
    flushSync(() => { setAnimate(false); setOpen(false) })
    if (!btn) return
    const navH = 72
    if (before >= navH && before <= window.innerHeight) {
      // toggle was on screen: keep it pinned where the reader's eye is
      window.scrollBy({ top: btn.getBoundingClientRect().top - before, behavior: 'instant' as ScrollBehavior })
    } else {
      // collapsed from the end of a long body: bring the article's headline back under the nav
      const anchor = btn.closest('article') ?? btn
      window.scrollBy({ top: anchor.getBoundingClientRect().top - navH, behavior: 'instant' as ScrollBehavior })
    }
  }
  const body = article.body?.trim() ?? ''
  const excerpt = article.excerpt?.trim() ?? ''
  // Older issues carry a "body" that merely restates the excerpt at ~2× length.
  // Only offer the expander when the body is materially longer than the excerpt.
  const substantive = body.length >= Math.max(300, excerpt.length * 2)
  const paras = substantive ? paragraphs(body) : []

  const links = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="link-ink text-ink-2">
        원문 보기
      </a>
      {article.hnUrl && (
        <a href={article.hnUrl} target="_blank" rel="noopener noreferrer" className="link-ink text-ink-2">
          HN 토론
        </a>
      )}
    </div>
  )

  if (paras.length === 0) return <div className="mt-3">{links}</div>

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <button
          type="button"
          ref={toggleRef}
          aria-expanded={open}
          aria-controls={id}
          onClick={open ? collapse : expand}
          className="inline-flex items-center gap-1.5 font-semibold text-accent"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
            className="transition-transform duration-200"
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}>
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {open ? '본문 접기' : '본문 읽기'}
        </button>
        {!open && links}
      </div>
      <div id={id} className="expand" data-open={open} style={animate ? undefined : { transition: 'none' }}>
        <div>
          <div
            className={`prose-body max-w-prose pt-4 text-ink ${size === 'lg' ? 'text-[17px] leading-[1.85]' : 'text-[16px] leading-[1.8]'}`}
          >
            {paras.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px]">
            {links}
            <button type="button" onClick={collapse} tabIndex={open ? 0 : -1}
              className="inline-flex items-center gap-1.5 font-semibold text-accent">
              본문 접기 ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
