import type { RedditPost } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { timeAgo, formatMetric } from '../utils/format'

interface Props {
  posts: RedditPost[]
}

const SUBREDDIT_COLORS: Record<string, string> = {
  MachineLearning: '#7C3AED',
  LocalLLaMA: '#F59E0B',
  artificial: '#06B6D4',
  OpenAI: '#10B981',
  ClaudeAI: '#D97706',
  programming: '#3B82F6',
  singularity: '#EC4899',
  ExperiencedDevs: '#8B5CF6',
}

function SubredditColor(sub: string): string {
  return SUBREDDIT_COLORS[sub] || '#FF4500'
}

function PostCard({ post }: { post: RedditPost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 border transition-all"
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
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="text-[10px] font-mono font-semibold px-1.5 py-0.5 shrink-0"
          style={{
            color: SubredditColor(post.subreddit),
            backgroundColor: `${SubredditColor(post.subreddit)}12`,
            border: `1px solid ${SubredditColor(post.subreddit)}30`,
          }}
        >
          r/{post.subreddit}
        </span>
        <span
          className="text-[10px] font-mono shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          {timeAgo(post.publishedAt)}
        </span>
      </div>

      <p
        className="text-[13px] font-sans leading-snug font-medium mb-1"
        style={{ color: 'var(--text)' }}
      >
        {post.title}
      </p>

      {post.originalTitle && post.originalTitle !== post.title && (
        <p
          className="text-[11px] font-sans leading-snug"
          style={{ color: 'var(--text-muted)' }}
        >
          {post.originalTitle}
        </p>
      )}

      {post.score > 0 && (
        <div className="flex items-center gap-1 mt-2" style={{ color: 'var(--text-muted)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L10 5H7v5H5V5H2L6 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11px] font-mono">{formatMetric(post.score)}</span>
        </div>
      )}
    </a>
  )
}

export default function RedditPulse({ posts }: Props) {
  if (!posts || posts.length === 0) return null

  return (
    <section
      id="reddit-pulse"
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: 'var(--bg-alternate, var(--bg))' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number="06"
          title="Reddit Pulse"
          subtitle="레딧 하이라이트"
          color="#FF4500"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}
