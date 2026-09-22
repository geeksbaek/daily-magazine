import type { ThreadsPost } from '../types/magazine'
import SectionShell from './SectionShell'
import SocialQuote from './SocialQuote'

interface Props {
  posts?: ThreadsPost[]
}

export default function ThreadsPulse({ posts }: Props) {
  if (!posts || posts.length === 0) return null
  return (
    <SectionShell id="threads-pulse" title="스레드에서" subtitle="Threads" count={posts.length} unit="건">
      <div className={`-mt-6 ${posts.length > 1 ? 'cols-2' : 'max-w-[680px]'}`}>
        {posts.map(t => (
          <SocialQuote
            key={t.id}
            platform="threads"
            author={t.author}
            handle={t.handle}
            content={t.content}
            thread={t.thread}
            context={t.context}
            url={t.url}
            publishedAt={t.publishedAt}
          />
        ))}
      </div>
    </SectionShell>
  )
}
