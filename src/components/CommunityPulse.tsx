import type { CommunityPost } from '../types/magazine'
import SectionShell from './SectionShell'
import { formatCount } from '../utils/format'

interface Props {
  posts?: CommunityPost[]
}

/** Legacy section kept for older issues; renders nothing when absent or empty. */
export default function CommunityPulse({ posts }: Props) {
  if (!posts || posts.length === 0) return null
  return (
    <SectionShell id="community-pulse" title="커뮤니티에서" subtitle="Community" count={posts.length} unit="건">
      <div className="-mt-4">
        {posts.map(p => (
          <article key={p.id} className="flex items-baseline justify-between gap-6 border-b border-rule py-4 last:border-b-0 last:pb-0">
            <h3 className="min-w-0 font-display text-[17px] font-semibold leading-[1.45] text-ink">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="title-link">{p.title}</a>
            </h3>
            <div className="shrink-0 text-right text-[12.5px] leading-snug text-ink-3 tabular">
              추천 {formatCount(p.recommend)}<br />조회 {formatCount(p.views)}
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  )
}
