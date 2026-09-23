import { useEffect, useState } from 'react'
import type { SectionLink } from '../components/MagazineNav'

const NAV_OFFSET = 120

/** Whole-page scroll percentage and the section currently under the nav. */
export function useReadingProgress(sections: SectionLink[]) {
  const [pct, setPct] = useState(0)
  const [active, setActive] = useState('')

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      setPct(max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0)
      let current = ''
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= NAV_OFFSET) current = s.id
      }
      setActive(current)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // expanding/collapsing article bodies changes the page height without scrolling
    const ro = new ResizeObserver(schedule)
    ro.observe(document.body)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [sections])

  return { pct, active }
}
