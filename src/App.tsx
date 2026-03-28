import { useState, useEffect } from 'react'
import type { Magazine, ArchiveIndex } from './types/magazine'
import { useTheme } from './hooks/useTheme'
import MagazineNav from './components/MagazineNav'
import Cover from './components/Cover'
import Highlights from './components/Highlights'
import NewsSection from './components/NewsSection'
import TwitterPulse from './components/TwitterPulse'
import QuickBites from './components/QuickBites'
import Archive from './components/Archive'
import PodcastPlayer from './components/PodcastPlayer'

const BASE = import.meta.env.BASE_URL

type View = 'magazine' | 'archive'

export default function App() {
  const { theme, toggle } = useTheme()
  const [view, setView] = useState<View>('magazine')
  const [magazine, setMagazine] = useState<Magazine | null>(null)
  const [archiveIndex, setArchiveIndex] = useState<ArchiveIndex | null>(null)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const idxRes = await fetch(`${BASE}data/index.json`)
        if (!idxRes.ok) throw new Error('Archive index not found')
        const idx: ArchiveIndex = await idxRes.json()
        setArchiveIndex(idx)

        if (idx.issues.length > 0) {
          const latest = idx.issues[0]
          setCurrentDate(latest.date)
          await loadMagazine(latest.date)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function loadMagazine(date: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BASE}data/${date}/magazine.json`)
      if (!res.ok) throw new Error(`Issue ${date} not found`)
      const data: Magazine = await res.json()
      setMagazine(data)
      setCurrentDate(date)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectIssue = async (date: string) => {
    await loadMagazine(date)
    setView('magazine')
    window.scrollTo({ top: 0 })
  }

  const handleReadIssue = () => {
    const el = document.getElementById('highlights')
    if (el) {
      window.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="text-center">
          <div
            className="font-serif font-black text-[24px] mb-6"
            style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
          >
            GEEK<span style={{ color: 'var(--accent)' }}>/</span>DAILY
          </div>
          <div className="flex items-center gap-2 justify-center">
            {[0, 150, 300].map(delay => (
              <div
                key={delay}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ backgroundColor: 'var(--accent)', animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="text-center max-w-sm px-6">
          <div
            className="font-serif font-black text-[24px] mb-6"
            style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
          >
            GEEK<span style={{ color: 'var(--accent)' }}>/</span>DAILY
          </div>
          <p className="text-[14px] mb-4 font-sans" style={{ color: 'var(--text-secondary)' }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-[12px] font-mono underline"
            style={{ color: 'var(--accent)' }}
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="magazine-scroll" style={{ backgroundColor: 'var(--bg)' }}>
      {magazine && (
        <MagazineNav
          date={currentDate}
          issueNumber={magazine.issueNumber}
          theme={theme}
          onToggleTheme={toggle}
          onShowArchive={() => setView('archive')}
        />
      )}

      {view === 'archive' && archiveIndex ? (
        <Archive
          issues={archiveIndex.issues}
          onSelectIssue={handleSelectIssue}
          onBack={() => { setView('magazine'); window.scrollTo({ top: 0 }) }}
        />
      ) : magazine ? (
        <>
          <Cover magazine={magazine} onReadIssue={handleReadIssue} />
          {magazine.podcast && (
            <PodcastPlayer podcast={magazine.podcast} date={currentDate} />
          )}
          <Highlights articles={magazine.highlights} />
          <NewsSection
            id="ai-ml"
            number="02"
            title="AI & Machine Learning"
            subtitle="인공지능 · 머신러닝"
            articles={magazine.sections.ai_ml}
            accentColor="#7C3AED"
            bgAlternate
          />
          <NewsSection
            id="dev-tools"
            number="03"
            title="Developer Tools"
            subtitle="개발 도구 · 플랫폼"
            articles={magazine.sections.dev_tools}
            accentColor="#0891B2"
          />
          <NewsSection
            id="big-tech"
            number="04"
            title="Big Tech"
            subtitle="빅테크 · 산업 동향"
            articles={magazine.sections.big_tech}
            accentColor="#1D4ED8"
            bgAlternate
          />
          <TwitterPulse tweets={magazine.sections.twitter_pulse} />
          <QuickBites articles={magazine.sections.quick_bites} />
        </>
      ) : null}
    </div>
  )
}
