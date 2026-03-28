import type { ArchiveEntry } from '../types/magazine'
import { formatIssueDate } from '../utils/format'

interface Props {
  issues: ArchiveEntry[]
  onSelectIssue: (date: string) => void
  onBack: () => void
}

export default function Archive({ issues, onSelectIssue, onBack }: Props) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 pt-[80px] pb-20">
        {/* Header */}
        <div className="py-10 border-b mb-10" style={{ borderColor: 'var(--border-strong)' }}>
          <button
            onClick={onBack}
            className="flex items-center gap-2 mb-6 text-[12px] font-mono transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            최신 이슈로 돌아가기
          </button>
          <h1
            className="font-serif font-black leading-none mb-2"
            style={{
              fontSize: 'clamp(40px, 6vw, 80px)',
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            Archive
          </h1>
          <p className="text-[14px] font-sans" style={{ color: 'var(--text-secondary)' }}>
            {issues.length}개 이슈 · 매일 아침 6시 발행
          </p>
        </div>

        {/* Issues list */}
        <div className="space-y-0">
          {issues.map((issue, idx) => (
            <button
              key={issue.date}
              onClick={() => onSelectIssue(issue.date)}
              className="group w-full text-left py-6 border-b flex items-start gap-6 transition-opacity hover:opacity-60"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Issue meta */}
              <div className="shrink-0 w-28">
                <div
                  className="text-[10px] font-mono tracking-widest mb-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  NO.{String(issue.issueNumber).padStart(3, '0')}
                </div>
                <div
                  className="text-[12px] font-mono"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {formatIssueDate(issue.date)}
                </div>
                {idx === 0 && (
                  <div
                    className="mt-1.5 text-[9px] font-mono tracking-widest px-1.5 py-0.5 inline-block"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      letterSpacing: '0.15em',
                    }}
                  >
                    LATEST
                  </div>
                )}
              </div>

              {/* Headline */}
              <div className="flex-1 min-w-0">
                <h3
                  className="font-serif font-semibold text-[18px] lg:text-[22px] leading-snug mb-3"
                  style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
                >
                  {issue.mainHeadline}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {issue.headlines.map((h, i) => (
                    <span
                      key={i}
                      className="text-[12px] font-sans"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
                  <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

        {issues.length === 0 && (
          <div className="py-20 text-center">
            <p className="font-serif text-[24px]" style={{ color: 'var(--text-muted)' }}>
              아직 발행된 이슈가 없습니다
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
