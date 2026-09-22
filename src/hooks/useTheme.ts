import { useState, useEffect, useSyncExternalStore, createContext, useContext } from 'react'

export type ThemeId = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeInfo {
  id: ThemeId
  label: string
}

export const THEMES: ThemeInfo[] = [
  { id: 'system', label: '시스템 설정' },
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
]

const KEY = 'gd-theme-v3'
const QUERY = '(prefers-color-scheme: dark)'

function subscribeSystem(cb: () => void) {
  const m = window.matchMedia(QUERY)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const readSystemDark = () => window.matchMedia(QUERY).matches
const readSystemDarkServer = () => false

const Ctx = createContext<ResolvedTheme>('light')
export const ThemeProvider = Ctx.Provider
export function useResolvedTheme(): ResolvedTheme { return useContext(Ctx) }

export function useTheme() {
  const [themeId, setTheme] = useState<ThemeId>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('theme') as ThemeId | null
    if (fromUrl && THEMES.some(t => t.id === fromUrl)) return fromUrl
    try {
      const s = localStorage.getItem(KEY) as ThemeId | null
      if (s && THEMES.some(t => t.id === s)) return s
    } catch { /* storage unavailable */ }
    return 'system'
  })
  const systemDark = useSyncExternalStore(subscribeSystem, readSystemDark, readSystemDarkServer)
  const resolved: ResolvedTheme = themeId === 'system' ? (systemDark ? 'dark' : 'light') : themeId

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  useEffect(() => {
    try { localStorage.setItem(KEY, themeId) } catch { /* ignore */ }
  }, [themeId])

  return { themeId, resolved, setTheme }
}
