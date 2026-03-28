import { useState, useEffect, createContext, useContext } from 'react'

export type ThemeId = 'editorial' | 'brutalist' | 'terminal' | 'broadsheet' | 'dashboard'

export interface ThemeInfo {
  id: ThemeId
  nameKo: string
  desc: string
  isDark: boolean
  accent: string
  bg: string
}

export const THEMES: ThemeInfo[] = [
  { id: 'editorial',  nameKo: '에디토리얼', desc: '클래식 매거진',   isDark: false, accent: '#C8102E', bg: '#FAFAF7' },
  { id: 'brutalist',  nameKo: '브루탈리스트', desc: '로우 & 볼드',    isDark: false, accent: '#FF0000', bg: '#FFFFFF' },
  { id: 'terminal',   nameKo: '터미널',     desc: '해커 스타일',    isDark: true,  accent: '#00FF85', bg: '#080808' },
  { id: 'broadsheet', nameKo: '뉴스페이퍼', desc: '브로드시트 신문', isDark: false, accent: '#1a1a1a', bg: '#F2EDE4' },
  { id: 'dashboard',  nameKo: '대시보드',   desc: '테크 HUD',      isDark: true,  accent: '#00D4FF', bg: '#060818' },
]

/* ── Context (so any component can read themeId) ── */
const Ctx = createContext<ThemeId>('editorial')
export const ThemeProvider = Ctx.Provider
export function useThemeId(): ThemeId { return useContext(Ctx) }

/* ── Core hook ── */
function getSystemDefault(): ThemeId {
  if (typeof window === 'undefined') return 'editorial'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dashboard' : 'editorial'
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement
  THEMES.forEach(t => root.classList.remove(`theme-${t.id}`))
  root.classList.add(`theme-${id}`)
  const info = THEMES.find(t => t.id === id)
  if (info?.isDark) { root.classList.add('dark') } else { root.classList.remove('dark') }
}

const KEY = 'gd-theme-v2'

export function useTheme() {
  const [themeId, set] = useState<ThemeId>(() => {
    const s = localStorage.getItem(KEY) as ThemeId | null
    if (s && THEMES.find(t => t.id === s)) return s
    return getSystemDefault()
  })

  useEffect(() => { applyTheme(themeId) }, [])
  useEffect(() => { applyTheme(themeId); localStorage.setItem(KEY, themeId) }, [themeId])

  return { themeId, theme: THEMES.find(t => t.id === themeId)!, setTheme: set }
}
