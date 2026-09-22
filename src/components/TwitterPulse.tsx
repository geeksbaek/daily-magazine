import type { Tweet } from '../types/magazine'
import SectionShell from './SectionShell'
import SocialQuote from './SocialQuote'

interface Props {
  tweets: Tweet[]
}

export default function TwitterPulse({ tweets }: Props) {
  if (!tweets || tweets.length === 0) return null
  return (
    <SectionShell id="twitter-pulse" title="X에서" subtitle="What the timeline is saying" count={tweets.length} unit="건">
      <div className="cols-2 -mt-6">
        {tweets.map(t => (
          <SocialQuote
            key={t.id}
            platform="x"
            author={t.author}
            handle={t.handle}
            content={t.content}
            thread={t.thread}
            context={t.context}
            retweetedBy={t.retweetedBy}
            quoted={t.quoted}
            url={t.url}
            publishedAt={t.publishedAt}
            metrics={t.metrics}
          />
        ))}
      </div>
    </SectionShell>
  )
}
