import type { Magazine } from '../types/magazine'
import { formatDate, formatIssueDate } from '../utils/format'
import { useThemeId } from '../hooks/useTheme'

interface Props {
  magazine: Magazine
  onReadIssue: () => void
}

export default function Cover(props: Props) {
  const themeId = useThemeId()
  switch (themeId) {
    case 'editorial':  return <Editorial {...props} />
    case 'terminal':   return <Terminal {...props} />
    case 'broadsheet': return <Broadsheet {...props} />
  }
}


/* ═══════════════════════════════════════════════════════
   1. EDITORIAL — Classic magazine hero
   ═══════════════════════════════════════════════════════ */
function Editorial({ magazine, onReadIssue }: Props) {
  const { cover, date, issueNumber } = magazine
  return (
    <section className="relative min-h-screen flex flex-col magazine-section"
      style={{ backgroundColor: 'var(--cover-bg)' }}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '200px' }} />
      <div className="relative flex flex-col flex-1 max-w-[1440px] mx-auto w-full px-6 lg:px-10 pt-[80px]">
        <div className="flex items-center justify-between py-6 border-b border-white/10">
          <div className="flex items-baseline gap-4">
            <h1 className="font-serif font-black text-[28px] md:text-[36px] tracking-[-0.02em] text-white leading-none">
              GEEK<span style={{ color: 'var(--cover-accent)' }}>/</span>DAILY
            </h1>
            <span className="text-white/30 font-mono text-[11px] tracking-widest">TECH · CULTURE · CODE</span>
          </div>
          <div className="text-right">
            <div className="text-white/60 font-mono text-[11px] tracking-widest">VOL.1 NO.{String(issueNumber).padStart(3, '0')}</div>
            <div className="text-white/30 font-mono text-[10px] mt-0.5">{formatIssueDate(date)}</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center py-12 lg:py-16">
          <div className="max-w-[900px]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--cover-accent)' }} />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: 'var(--cover-accent)' }}>Today's Lead Story</span>
            </div>
            <h2 className="font-serif font-black text-white leading-[1.05] mb-6" style={{ fontSize: 'clamp(36px, 6vw, 84px)' }}>{cover.mainHeadline}</h2>
            <p className="text-white/50 text-[16px] lg:text-[18px] leading-relaxed max-w-[680px] font-sans font-light">{cover.mainExcerpt}</p>
          </div>
        </div>
        <div className="mt-auto">
          <div className="border-t border-white/10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
            {cover.headlines.map((h, i) => (
              <div key={i} className="py-5 md:px-6 first:pl-0 last:pr-0">
                <div className="text-white/25 font-mono text-[9px] tracking-[0.3em] mb-2">0{i + 2}</div>
                <p className="text-white/70 text-[13px] leading-snug font-sans">{h}</p>
              </div>
            ))}
          </div>
          <div className="py-6 flex items-center justify-between border-t border-white/10">
            <span className="text-white/30 font-mono text-[10px] tracking-widest">{formatDate(date)}</span>
            <button onClick={onReadIssue} className="group flex items-center gap-3 text-white/80 hover:text-white transition-colors">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase">Read Issue</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-[1px] bg-white/40 group-hover:w-10 transition-all duration-300" />
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="text-white/40 group-hover:text-white transition-colors">
                  <path d="M1 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}



/* ═══════════════════════════════════════════════════════
   3. TERMINAL — Monospace, ASCII art, hacker aesthetic
   ═══════════════════════════════════════════════════════ */
function Terminal({ magazine, onReadIssue }: Props) {
  const { cover, date, issueNumber } = magazine
  const num = String(issueNumber).padStart(3, '0')
  const mono = { fontFamily: '"DM Mono", monospace' }
  const dim = { ...mono, opacity: 0.4 }
  return (
    <section className="magazine-section" style={{ backgroundColor: 'var(--cover-bg)', minHeight: '100vh', paddingTop: '80px' }}>
      <div className="max-w-[880px] mx-auto px-6 py-12" style={{ ...mono, color: 'var(--cover-accent)' }}>
        <div className="overflow-x-auto">
          <div className="text-[12px] sm:text-[13px] leading-relaxed" style={{ color: 'var(--cover-accent)' }}>
            <div style={dim}>$ cat /var/geekdaily/{date}/issue-{num}.log</div>
            <div className="mt-4" style={{ opacity: 0.35 }}>{'─'.repeat(40)}</div>
            <div className="mt-2 pl-2">GEEK/DAILY — Issue #{num}</div>
            <div className="pl-2">{formatIssueDate(date)}</div>
            <div className="mt-2" style={{ opacity: 0.35 }}>{'─'.repeat(40)}</div>
          </div>
        </div>

        {/* Main headline */}
        <div className="mt-10">
          <span style={{ opacity: 0.5 }}>{'> '}</span>
          <span style={{ fontSize: 'clamp(22px, 4vw, 44px)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' }}>
            {cover.mainHeadline}
          </span>
        </div>

        <div className="mt-4 pl-4" style={{ opacity: 0.55, fontSize: '14px', lineHeight: 1.7, maxWidth: '680px' }}>
          {cover.mainExcerpt}
        </div>

        {/* Teasers */}
        <div className="mt-10" style={{ fontSize: '13px' }}>
          <div style={dim}>{'── also in this issue ' + '─'.repeat(30)}</div>
          {cover.headlines.map((h, i) => (
            <div key={i} className="mt-2">
              <span style={{ opacity: 0.4 }}>[0{i + 2}]</span>{' '}
              <span style={{ opacity: 0.75 }}>{h}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button onClick={onReadIssue} className="mt-10" style={{
          ...mono,
          color: 'var(--cover-accent)',
          background: 'none',
          border: '1px solid var(--cover-accent)',
          padding: '8px 28px',
          fontSize: '13px',
          cursor: 'pointer',
          opacity: 0.8,
        }}>
          $ read-issue --interactive <span className="animate-pulse">▊</span>
        </button>

        <div className="mt-6" style={dim}>{'─'.repeat(40)}</div>
      </div>
    </section>
  )
}


/* ═══════════════════════════════════════════════════════
   4. BROADSHEET — Classic newspaper masthead + columns
   ═══════════════════════════════════════════════════════ */
function Broadsheet({ magazine, onReadIssue }: Props) {
  const { cover, date, issueNumber } = magazine
  return (
    <section className="magazine-section" style={{ backgroundColor: 'var(--bg)', paddingTop: '80px' }}>
      <div className="max-w-[960px] mx-auto px-6">
        {/* Newspaper masthead */}
        <div className="text-center py-6">
          <div style={{ borderTop: '3px double var(--text)', borderBottom: '1px solid var(--text)', padding: '6px 0' }}>
            <div style={{ borderTop: '1px solid var(--text)', borderBottom: '3px double var(--text)', padding: '14px 0' }}>
              <h1 className="font-serif font-black" style={{
                fontSize: 'clamp(44px, 7vw, 72px)',
                color: 'var(--text)',
                letterSpacing: '0.1em',
                lineHeight: 1,
              }}>
                GEEK/DAILY
              </h1>
              <p className="font-serif italic text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                매일 아침 개발자를 위한 테크 매거진
              </p>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 px-2 text-[11px]" style={{ fontFamily: '"DM Mono", monospace', color: 'var(--text-muted)' }}>
            <span>VOL.1</span>
            <span>{formatDate(date)}</span>
            <span>제{String(issueNumber).padStart(3, '0')}호</span>
          </div>
        </div>

        {/* Main headline + sidebar columns */}
        <div className="grid grid-cols-1 md:grid-cols-[5fr_3fr] gap-0 py-6" style={{ borderTop: '2px solid var(--text)' }}>
          <div className="md:pr-6" style={{ borderRight: '1px solid var(--border-strong)' }}>
            <h2 className="font-serif font-black leading-[1.08]" style={{
              fontSize: 'clamp(26px, 3.5vw, 42px)',
              color: 'var(--text)',
            }}>
              {cover.mainHeadline}
            </h2>
            <p className="mt-3 font-serif text-[14px] leading-[1.7]" style={{
              color: 'var(--text-secondary)',
              textAlign: 'justify',
              textJustify: 'inter-word',
            }}>
              {cover.mainExcerpt}
            </p>
            <button onClick={onReadIssue} className="mt-3 font-serif text-[12px] italic underline" style={{ color: 'var(--text)' }}>
              계속 읽기 →
            </button>
          </div>

          <div className="md:pl-6 mt-4 md:mt-0">
            {cover.headlines.map((h, i) => (
              <div key={i} className="pb-3 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-muted)' }}>0{i + 2}</span>
                <h3 className="font-serif font-semibold text-[14px] leading-snug mt-1" style={{ color: 'var(--text)' }}>{h}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}


