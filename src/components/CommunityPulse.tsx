import type { CommunityPost } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { timeAgo, formatMetric } from '../utils/format'

interface Props {
  posts: CommunityPost[]
}

function PostCard({ post, index }: { post: CommunityPost; index: number }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 p-4 border-b transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {/* Rank number */}
      <span
        className="text-[20px] font-serif font-bold shrink-0 w-8 text-right leading-tight"
        style={{ color: 'var(--text-muted)', opacity: 0.4 }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-sans leading-snug font-medium"
          style={{ color: 'var(--text)' }}
        >
          {post.title}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(post.publishedAt)}
          </span>
          {post.recommend > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1l1.2 2.8H9L7 5.5l.8 3L5 6.8 2.2 8.5l.8-3L.5 3.8h2.8L5 1z" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
              </svg>
              {post.recommend}
            </span>
          )}
          {post.views > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <ellipse cx="5" cy="5" rx="4" ry="2.5" stroke="currentColor" strokeWidth="0.8"/>
                <circle cx="5" cy="5" r="1.2" stroke="currentColor" strokeWidth="0.8"/>
              </svg>
              {formatMetric(post.views)}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

export default function CommunityPulse({ posts }: Props) {
  if (!posts || posts.length === 0) return null

  return (
    <section
      id="community-pulse"
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number="08"
          title="Community Pulse"
          subtitle="디시인사이드 · 특이점갤"
          color="#1D8CE0"
        />

        <div className="max-w-3xl">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
