import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Article } from '../types/magazine'
import { formatClock, paragraphs } from '../utils/format'
import { TierMark } from './SourceLine'
import Marked from './Marked'

interface Props {
  article: Article
}

function ArticleLinks({ article }: Props) {
  return (
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
}

/**
 * "본문 읽기" opens the long-form body in a modal reader (full screen on phones).
 * Articles without a substantive body only get the outbound links.
 */
export default function ArticleBody({ article }: Props) {
  const [open, setOpen] = useState(false)
  const body = article.body?.trim() ?? ''
  const excerpt = article.excerpt?.trim() ?? ''
  // Older issues carry a "body" that merely restates the excerpt at ~2× length.
  // Only offer the reader when the body is materially longer than the excerpt.
  const substantive = body.length >= Math.max(300, excerpt.length * 2)
  const paras = substantive ? paragraphs(body) : []

  if (paras.length === 0) {
    return <div className="mt-3"><ArticleLinks article={article} /></div>
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <button
          type="button"
          data-part="read-body"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 font-semibold text-accent"
        >
          본문 읽기
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {open && createPortal(<ArticleReader article={article} paras={paras} onClose={() => setOpen(false)} />, document.body)}
    </div>
  )
}

/**
 * Native <dialog> in the top layer: Esc, focus trapping and focus return come from the browser.
 * An extra history entry lets the phone's back gesture close the reader instead of leaving the site.
 */
function ArticleReader({ article, paras, onClose }: { article: Article; paras: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // the page re-renders on every scroll tick (reading progress); keep the effect from re-running
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    dialog.scrollTop = 0
    if (!history.state?.gdReader) history.pushState({ gdReader: true }, '')
    // close() before unmounting so the browser returns focus to the "본문 읽기" button
    const onPop = () => { if (dialog.open) dialog.close(); onCloseRef.current() }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (dialog.open) dialog.close()
    }
  }, [])

  // leave through history so the extra entry never lingers; popstate then unmounts us
  const close = () => {
    if (history.state?.gdReader) history.back()
    else { ref.current?.close(); onCloseRef.current() }
  }

  return (
    <dialog
      ref={ref}
      className="reader-dialog"
      aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); close() }}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="reader-dialog__bar">
        <span className="reader-dialog__source">
          {article.publisher || article.source}
          {article.publisher && article.publisher !== article.source && <span> · {article.source} 경유</span>}
        </span>
        <button type="button" onClick={close} className="reader-dialog__close" aria-label="본문 닫기">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M3 3l10 10M13 3 3 13" />
          </svg>
        </button>
      </div>

      <article className="reader-dialog__page">
        <div className="reader-dialog__meta">
          <TierMark tier={article.tier} />
          {article.publishedAt && <span className="tabular">{formatClock(article.publishedAt)}</span>}
          {article.readTime ? <span className="tabular">{article.readTime}분</span> : null}
        </div>
        <h2 id={titleId} className="reader-dialog__title font-display">{article.title}</h2>
        {article.excerpt && <p className="reader-dialog__dek"><Marked text={article.excerpt} /></p>}
        <div className="prose-body reader-dialog__body">
          {paras.map((p, i) => <p key={i}><Marked text={p} /></p>)}
        </div>
        <footer className="reader-dialog__foot">
          <ArticleLinks article={article} />
          <button type="button" onClick={close} className="font-semibold text-accent">닫기</button>
        </footer>
      </article>
    </dialog>
  )
}
