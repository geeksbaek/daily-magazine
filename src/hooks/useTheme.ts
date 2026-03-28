import { useState, useEffect } from 'react'

export type ThemeId = 'classic' | 'dark' | 'terminal' | 'sepia' | 'cyber'

export interface ThemeInfo {
  id: ThemeId
  nameKo: string
  isDark: boolean
  accent: string   // swatch accent color
  bg: string       // swatch background color
}

export const THEMES: ThemeInfo[] = [
  { id: 'classic',  nameKo: '클래식', isDark: false, accent: '#C8102E', bg: '#FAFAF7' },
  { id: 'dark',     nameKo: '다크',   isDark: true,  accent: '#FF3355', bg: '#0E0E0A' },
  { id: 'terminal', nameKo: '터미널', isDark: true,  accent: '#00FF85', bg: '#080808' },
  { id: 'sepia',    nameKo: '세피아', isDark: false, accent: '#C05800', bg: '#F6F0E4' },
  { id: 'cyber',    nameKo: '사이버', isDark: true,  accent: '#00D4FF', bg: '#060818' },
]

function getSystemDefault(): ThemeId {
  if (typeof window === 'undefined') return 'classic'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'classic'
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement
  // Remove all existing theme classes
  THEMES.forEach(t => root.classList.remove(`theme-${t.id}`))
  // Apply the chosen theme class
  root.classList.add(`theme-${id}`)
  // Toggle Tailwind .dark class for dark: utility support
  const info = THEMES.find(t => t.id === id)
  if (info?.isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

const STORAGE_KEY = 'gd-theme-v2'

export function useTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (stored && THEMES.find(t => t.id === stored)) return stored
    return getSystemDefault()
  })

  // Apply on initial mount (before first render completes)
  useEffect(() => {
    applyTheme(themeId)
  }, [])

  // Apply whenever themeId changes
  useEffect(() => {
    applyTheme(themeId)
    localStorage.setItem(STORAGE_KEY, themeId)
  }, [themeId])

  const setTheme = (id: ThemeId) => setThemeIdState(id)
  const currentTheme = THEMES.find(t => t.id === themeId)!

  return { themeId, theme: currentTheme, setTheme }
}
