import type { ThreadsPost } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { timeAgo } from '../utils/format'

interface Props {
  posts: ThreadsPost[]
}

function ThreadsCard({ post }: { post: ThreadsPost }) {
  const initials = post.author
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <a
      href={post.url}
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
            className="w-8 h-8 flex items-center justify-center text-white text-[11px] font-bold font-mono shrink-0 rounded-full"
            style={{ backgroundColor: '#000000' }}
          >
            {initials}
          </div>
          <div>
            <div
              className="text-[13px] font-semibold leading-tight"
              style={{ color: 'var(--text)' }}
            >
              {post.author}
            </div>
            <div
              className="text-[11px] font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              @{post.handle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Threads logo mini */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)' }}>
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.434 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.432 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-.86 1.068-2.056 1.67-3.559 1.79-1.171.094-2.292-.17-3.148-.744-.928-.623-1.497-1.583-1.602-2.7-.098-1.035.266-2.004 1.027-2.73.695-.664 1.665-1.084 2.814-1.22.95-.112 1.917-.078 2.876.1.038-.505.036-.992-.007-1.453-.12-1.262-.637-1.81-1.622-1.912-.494-.05-1.016.03-1.376.266-.315.207-.494.534-.545 1.005l-2.09-.108c.1-1.2.611-2.134 1.52-2.774.815-.576 1.884-.882 3.09-.882.247 0 .5.013.755.042 1.7.17 2.89.994 3.316 2.3.202.62.29 1.33.258 2.108-.013.32-.038.643-.078.968l-.002.014c-.02.196-.042.392-.069.586 1.162.626 2.068 1.5 2.613 2.545.817 1.567.945 4.213-1.17 6.294-1.838 1.81-4.043 2.584-7.15 2.608zM10.18 15.586c.07.738.476 1.205 1.18 1.354.513.107 1.21.07 1.73.028 1.003-.08 1.775-.478 2.294-1.184.34-.462.583-1.05.726-1.76-.91-.16-1.84-.216-2.754-.12-.863.102-2.32.43-2.478 1.39-.038.093-.058.192-.058.292h.36z" fill="currentColor"/>
          </svg>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(post.publishedAt)}
          </span>
        </div>
      </div>

      {/* Post content — thread chain displayed as one */}
      <div className="space-y-0">
        <p
          className="text-[13px] leading-relaxed font-sans whitespace-pre-line"
          style={{ color: 'var(--text-secondary)' }}
        >
          {post.content}
        </p>
        {post.thread && post.thread.length > 0 && post.thread.map((text, i) => (
          <div key={i} className="flex gap-2.5 mt-2 pt-2">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-px flex-1" style={{ backgroundColor: 'var(--border-strong)', minHeight: '100%' }} />
            </div>
            <p
              className="text-[13px] leading-relaxed font-sans whitespace-pre-line"
              style={{ color: 'var(--text-secondary)' }}
            >
              {text}
            </p>
          </div>
        ))}
      </div>

      {/* Context explanation */}
      {post.context && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0 mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" />
              <path d="M7 4.5v3M7 9.5v0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <p
              className="text-[12px] leading-relaxed font-sans"
              style={{ color: 'var(--text-muted)' }}
            >
              {post.context}
            </p>
          </div>
        </div>
      )}
    </a>
  )
}

export default function ThreadsPulse({ posts }: Props) {
  if (!posts || posts.length === 0) return null

  return (
    <section
      id="threads-pulse"
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: 'var(--bg-raised)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number="06"
          title="Threads Pulse"
          subtitle="Threads 하이라이트"
          color="#000000"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {posts.map(post => (
            <ThreadsCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}
