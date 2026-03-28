import type { Magazine } from '../types/magazine'
import { formatDate, formatIssueDate } from '../utils/format'

interface Props {
  magazine: Magazine
  onReadIssue: () => void
}

export default function Cover({ magazine, onReadIssue }: Props) {
  const { cover, date, issueNumber } = magazine

  return (
    <section
      className="relative min-h-screen flex flex-col magazine-section"
      style={{ backgroundColor: 'var(--cover-bg)' }}
    >
      {/* Subtle grain texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      <div className="relative flex flex-col flex-1 max-w-[1440px] mx-auto w-full px-6 lg:px-10 pt-[80px]">

        {/* Top bar */}
        <div className="flex items-center justify-between py-6 border-b border-white/10">
          <div className="flex items-baseline gap-4">
            <h1 className="font-serif font-black text-[28px] md:text-[36px] tracking-[-0.02em] text-white leading-none">
              GEEK<span style={{ color: 'var(--cover-accent)' }}>/</span>DAILY
            </h1>
            <span className="text-white/30 font-mono text-[11px] tracking-widest">
              TECH · CULTURE · CODE
            </span>
          </div>
          <div className="text-right">
            <div className="text-white/60 font-mono text-[11px] tracking-widest">
              VOL.1 NO.{String(issueNumber).padStart(3, '0')}
            </div>
            <div className="text-white/30 font-mono text-[10px] mt-0.5">
              {formatIssueDate(date)}
            </div>
          </div>
        </div>

        {/* Main hero headline */}
        <div className="flex-1 flex flex-col justify-center py-12 lg:py-16">
          <div className="max-w-[900px]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--cover-accent)' }} />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase"
                style={{ color: 'var(--cover-accent)' }}>
                Today's Lead Story
              </span>
            </div>

            <h2 className="font-serif font-black text-white leading-[1.05] mb-6"
              style={{ fontSize: 'clamp(36px, 6vw, 84px)' }}
            >
              {cover.mainHeadline}
            </h2>

            <p className="text-white/50 text-[16px] lg:text-[18px] leading-relaxed max-w-[680px] font-sans font-light">
              {cover.mainExcerpt}
            </p>
          </div>
        </div>

        {/* Bottom: three teasers + CTA */}
        <div className="mt-auto">
          <div className="border-t border-white/10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 mb-0">
            {cover.headlines.map((headline, i) => (
              <div key={i} className="py-5 md:px-6 first:pl-0 last:pr-0">
                <div className="text-white/25 font-mono text-[9px] tracking-[0.3em] mb-2">
                  0{i + 2}
                </div>
                <p className="text-white/70 text-[13px] leading-snug font-sans">
                  {headline}
                </p>
              </div>
            ))}
          </div>

          {/* Read issue CTA */}
          <div className="py-6 flex items-center justify-between border-t border-white/10">
            <span className="text-white/30 font-mono text-[10px] tracking-widest">
              {formatDate(date)}
            </span>
            <button
              onClick={onReadIssue}
              className="group flex items-center gap-3 text-white/80 hover:text-white transition-colors"
            >
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase">Read Issue</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-[1px] bg-white/40 group-hover:w-10 transition-all duration-300" />
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none"
                  className="text-white/40 group-hover:text-white transition-colors">
                  <path d="M1 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
