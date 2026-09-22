import { THEMES, type ThemeId } from '../hooks/useTheme'

interface Props {
  themeId: ThemeId
  onSetTheme: (id: ThemeId) => void
}

const ORDER: ThemeId[] = ['system', 'light', 'dark']

function Icon({ id }: { id: ThemeId }) {
  if (id === 'light') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    )
  }
  if (id === 'dark') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Cycles system → light → dark. One button, one job. */
export default function ThemeSwitcher({ themeId, onSetTheme }: Props) {
  const current = THEMES.find(t => t.id === themeId) ?? THEMES[0]
  const next = ORDER[(ORDER.indexOf(themeId) + 1) % ORDER.length]
  const nextInfo = THEMES.find(t => t.id === next)!
  return (
    <button
      type="button"
      onClick={() => onSetTheme(next)}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
      title={`화면: ${current.label} (누르면 ${nextInfo.label})`}
      aria-label={`화면 테마 바꾸기, 현재 ${current.label}`}
    >
      <Icon id={themeId} />
    </button>
  )
}
