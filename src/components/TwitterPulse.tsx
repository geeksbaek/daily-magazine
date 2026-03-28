import type { Tweet } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { timeAgo } from '../utils/format'

interface Props {
  tweets: Tweet[]
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  const initials = tweet.author
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Deterministic color from handle
  const colors = [
    '#1DA1F2', '#E1306C', '#FF6B35', '#28A745',
    '#6F42C1', '#FD7E14', '#20C997', '#DC3545',
  ]
  const color = colors[tweet.handle.charCodeAt(0) % colors.length]

  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-5 border transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Author */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 flex items-center justify-center text-white text-[11px] font-bold font-mono shrink-0"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <div>
            <div
              className="text-[13px] font-semibold leading-tight"
              style={{ color: 'var(--text)' }}
            >
              {tweet.author}
            </div>
            <div
              className="text-[11px] font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              @{tweet.handle}
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(tweet.publishedAt)}
        </span>
      </div>

      {/* Content */}
      <p
        className="text-[13px] leading-relaxed font-sans"
        style={{ color: 'var(--text-secondary)' }}
      >
        {tweet.content}
      </p>


    </a>
  )
}

export default function TwitterPulse({ tweets }: Props) {
  return (
    <section
      id="twitter-pulse"
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number="05"
          title="Twitter Pulse"
          subtitle="X(트위터) 하이라이트"
          color="#1DA1F2"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tweets.map(tweet => (
            <TweetCard key={tweet.id} tweet={tweet} />
          ))}
        </div>
      </div>
    </section>
  )
}
