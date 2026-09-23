import { useEffect, useState } from 'react'
import { DEFAULT_DESIGN, DESIGNS } from '../designs/registry'

const KEY = 'gd-design-v1'

function initial(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('design')
  if (fromUrl && DESIGNS.some(d => d.id === fromUrl)) return fromUrl
  try {
    const s = localStorage.getItem(KEY)
    if (s && DESIGNS.some(d => d.id === s)) return s
  } catch { /* storage unavailable */ }
  return DEFAULT_DESIGN
}

export function useDesign() {
  const [designId, setDesign] = useState<string>(initial)

  useEffect(() => {
    document.documentElement.dataset.design = designId
    try { localStorage.setItem(KEY, designId) } catch { /* ignore */ }
    // load only the active design's fonts
    const meta = DESIGNS.find(d => d.id === designId)
    for (const href of meta?.fonts ?? []) {
      if (!document.querySelector(`link[data-design-font][href="${href}"]`)) {
        const l = document.createElement('link')
        l.rel = 'stylesheet'
        l.href = href
        l.dataset.designFont = designId
        document.head.appendChild(l)
      }
    }
  }, [designId])

  return { designId, setDesign }
}
