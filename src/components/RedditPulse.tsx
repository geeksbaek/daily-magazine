import type { RedditPost } from '../types/magazine'
import SectionShell from './SectionShell'
import { formatClock, formatCount } from '../utils/format'

interface Props {
  posts?: RedditPost[]
}

/** Reddit posts as vote rows: score column on the left, then subreddit, title, and summary. */
export default function RedditPulse({ posts }: Props) {
  if (!posts || posts.length === 0) return null
  return (
    <SectionShell id="reddit-pulse" title="레딧에서" subtitle="Reddit" count={posts.length} unit="건">
      <div className="-mt-5">
        {posts.map(post => (
          <article key={post.id} data-part="reddit" className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-4 border-b border-rule py-5 last:border-b-0 last:pb-0 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-6">
            <div className="pt-1 text-center">
              <div className="font-display text-[20px] font-bold leading-none text-ink tabular" aria-label={post.score > 0 ? `추천 ${post.score}` : '추천 수 없음'}>
                <svg width="10" height="7" viewBox="0 0 10 7" aria-hidden="true" className={`mx-auto text-ink-3 ${post.score > 0 ? 'mb-1' : 'opacity-60'}`} fill="currentColor">
                  <path d="M5 0 10 7H0z" />
                </svg>
                {post.score > 0 && formatCount(post.score)}
              </div>
              {typeof post.numComments === 'number' && (
                <div className="mt-2 text-[11.5px] leading-tight text-ink-3 tabular">
                  댓글<br />{formatCount(post.numComments)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <a
                href={`https://www.reddit.com/r/${post.subreddit}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-[3px] bg-accent-soft px-1.5 py-[2px] text-[12px] font-semibold leading-[16px] text-accent"
              >
                r/{post.subreddit}
              </a>
              <h3 className="mt-2 font-display text-[19px] font-semibold leading-[1.4] text-ink">
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="title-link">
                  {post.title}
                </a>
              </h3>
              {post.originalTitle && post.originalTitle !== post.title && (
                <p className="mt-1 text-[13px] leading-snug text-ink-3">{post.originalTitle}</p>
              )}
              {post.summary && (
                <p className="mt-2.5 max-w-prose text-[14.5px] leading-[1.7] text-ink-2">{post.summary}</p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 text-[12.5px] text-ink-3 tabular">
                <span>{formatClock(post.publishedAt)}</span>
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="link-ink text-ink-2">
                  토론 보기
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
