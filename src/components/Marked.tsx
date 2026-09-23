import { useCallback } from 'react'

// One shared observer for every mark on the page (and inside the reader dialog, whose
// scroll box clips its content, so the default viewport root still sees it correctly).
let observer: IntersectionObserver | null = null
function observe(el: Element) {
  if (typeof IntersectionObserver === 'undefined') {
    el.setAttribute('data-seen', '')
    return
  }
  observer ??= new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.setAttribute('data-seen', '')
        observer?.unobserve(e.target)
      }
    },
    // start the sweep once the phrase is comfortably on screen, not at the very bottom edge
    { rootMargin: '0px 0px -18% 0px' },
  )
  observer.observe(el)
}

const MARK = /==([^=\n]+?)==/g

/** Strip the editor's highlight markers, for places that need plain text. */
export function unmark(text: string): string {
  return text.replace(MARK, '$1')
}

/**
 * Renders text with the editor's `==highlight==` markers as a highlighter stroke
 * that sweeps in when the phrase scrolls into view.
 */
export default function Marked({ text }: { text: string }) {
  const ref = useCallback((el: HTMLElement | null) => { if (el) observe(el) }, [])
  if (!text.includes('==')) return <>{text}</>
  const parts = text.split(MARK)
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} ref={ref} className="hl">{part}</mark> : part))}
    </>
  )
}
