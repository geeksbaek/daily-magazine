import { useState, useEffect, useMemo } from 'react'
import type { Magazine, ArchiveIndex } from './types/magazine'
import { useTheme, ThemeProvider } from './hooks/useTheme'
import { useDesign } from './hooks/useDesign'
import MagazineNav, { Wordmark, type SectionLink } from './components/MagazineNav'
import Cover from './components/Cover'
import Highlights from './components/Highlights'
import NewsSection from './components/NewsSection'
import TwitterPulse from './components/TwitterPulse'
import ThreadsPulse from './components/ThreadsPulse'
import RedditPulse from './components/RedditPulse'
import CommunityPulse from './components/CommunityPulse'
import QuickBites from './components/QuickBites'
import Archive from './components/Archive'
import PodcastPlayer from './components/PodcastPlayer'
import Footer from './components/Footer'
import { navBottom } from './utils/format'
import ReadingProgress from './components/ReadingProgress'
import { useReadingProgress } from './hooks/useReadingProgress'

const BASE = import.meta.env.BASE_URL
type View = 'magazine' | 'archive'

function sectionLinks(m: Magazine): SectionLink[] {
  const s = m.sections
  const all: SectionLink[] = [
    { id: 'highlights', label: '주요 기사', count: m.highlights?.length ?? 0 },
    { id: 'ai-ml', label: 'AI', count: s.ai_ml?.length ?? 0 },
    { id: 'dev-tools', label: '개발 도구', count: s.dev_tools?.length ?? 0 },
    { id: 'big-tech', label: '빅테크', count: s.big_tech?.length ?? 0 },
    { id: 'twitter-pulse', label: 'X', count: s.twitter_pulse?.length ?? 0 },
    { id: 'threads-pulse', label: '스레드', count: s.threads_pulse?.length ?? 0 },
    { id: 'reddit-pulse', label: '레딧', count: s.reddit_pulse?.length ?? 0 },
    { id: 'community-pulse', label: '커뮤니티', count: s.community_pulse?.length ?? 0 },
    { id: 'quick-bites', label: '짧게 읽기', count: s.quick_bites?.length ?? 0 },
  ]
  return all.filter(x => x.count > 0)
}

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - navBottom()
  window.scrollTo({ top, behavior: 'smooth' })
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-sm text-center">
        <Wordmark className="text-[26px]" />
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

export default function App() {
  const { themeId, resolved, setTheme } = useTheme()
  const { designId, setDesign } = useDesign()
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
        if (!idxRes.ok) throw new Error('호 목록을 불러오지 못했습니다.')
        const idx: ArchiveIndex = await idxRes.json()
        setArchiveIndex(idx)
        const params = new URLSearchParams(window.location.search)
        const wanted = params.get('date')
        const pick = (wanted && idx.issues.find(i => i.date === wanted)) || idx.issues[0]
        if (pick) await loadMagazine(pick.date)
      } catch (e) {
        setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function loadMagazine(date: string) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BASE}data/${date}/magazine.json`)
      if (!res.ok) throw new Error(`${date} 호를 찾을 수 없습니다.`)
      const data: Magazine = await res.json()
      setMagazine(data); setCurrentDate(date)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const links = useMemo(() => (magazine ? sectionLinks(magazine) : []), [magazine])
  const progress = useReadingProgress(links)

  const goHome = () => { setView('magazine'); window.scrollTo({ top: 0 }) }
  const showArchive = () => { setView('archive'); window.scrollTo({ top: 0 }) }
  const selectIssue = async (date: string) => { await loadMagazine(date); goHome() }

  // Only the first load swaps in the full-screen shell. Switching issues keeps the nav mounted:
  // if the fixed nav disappears even briefly, iOS home-screen web apps switch the status bar
  // to a translucent blur edge and never switch it back.
  if (loading && !magazine) {
    return (
      <Shell>
        <p className="text-[14px] text-ink-2">오늘 호를 펼치는 중</p>
      </Shell>
    )
  }

  if (!magazine) {
    return (
      <Shell>
        <p className="text-[14px] text-ink-2">{error ?? '표시할 호가 없습니다.'}</p>
        <button type="button" onClick={() => window.location.reload()} className="link-ink mt-4 text-[13px] text-accent">
          다시 불러오기
        </button>
      </Shell>
    )
  }

  const s = magazine.sections

  return (
    <ThemeProvider value={resolved}>
      <div className="bg-paper text-ink">
        <MagazineNav
          date={currentDate}
          issueNumber={magazine.issueNumber}
          sections={links}
          view={view}
          designId={designId}
          onSetDesign={setDesign}
          themeId={themeId}
          onSetTheme={setTheme}
          onShowArchive={showArchive}
          onHome={goHome}
          onJump={scrollToId}
          progress={view === 'magazine' ? progress.pct : null}
        />

        {error && (
          <p role="alert" className="wrap pt-[88px] text-[14px] text-accent">{error}</p>
        )}

        {view === 'archive' && archiveIndex ? (
          <Archive issues={archiveIndex.issues} currentDate={currentDate} onSelectIssue={selectIssue} />
        ) : (
          <main>
            <ReadingProgress issueNumber={magazine.issueNumber} date={currentDate} sections={links} pct={progress.pct} active={progress.active} onJump={scrollToId} />
            <Cover
              magazine={magazine}
              contents={links}
              onReadIssue={() => scrollToId(links[0]?.id ?? 'highlights')}
              onJump={scrollToId}
            />
            {magazine.podcast && <PodcastPlayer podcast={magazine.podcast} issueNumber={magazine.issueNumber} />}
            <Highlights articles={magazine.highlights} />
            <NewsSection id="ai-ml" title="AI와 머신러닝" subtitle="AI and machine learning" articles={s.ai_ml} />
            <NewsSection id="dev-tools" title="개발 도구" subtitle="Developer tools" articles={s.dev_tools} />
            <NewsSection id="big-tech" title="빅테크" subtitle="Big tech" articles={s.big_tech} />
            <TwitterPulse tweets={s.twitter_pulse} />
            <ThreadsPulse posts={s.threads_pulse} />
            <RedditPulse posts={s.reddit_pulse} />
            <CommunityPulse posts={s.community_pulse} />
            <QuickBites articles={s.quick_bites} />
          </main>
        )}

        <Footer date={currentDate} issueNumber={magazine.issueNumber} onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onShowArchive={showArchive} />
      </div>
    </ThemeProvider>
  )
}
