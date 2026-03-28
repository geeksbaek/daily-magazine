import type { Article } from '../types/magazine'
import SectionHeader from './SectionHeader'
import { FeaturedCard, StandardCard } from './ArticleCard'

interface Props {
  articles: Article[]
}

export default function Highlights({ articles }: Props) {
  const [featured, ...rest] = articles
  const secondary = rest.slice(0, 2)
  const tertiary = rest.slice(2, 4)

  return (
    <section
      id="highlights"
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number="01"
          title="Today's Highlights"
          subtitle="주요 뉴스 딥다이브"
        />

        {/* Primary grid: featured + 2 secondary */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_3fr] gap-8 lg:gap-10 mb-0">
          {/* Large featured */}
          {featured && (
            <div className="border-b pb-8 lg:border-b-0 lg:pb-0 lg:border-r lg:pr-10"
              style={{ borderColor: 'var(--border)' }}>
              <FeaturedCard article={featured} size="large" />
            </div>
          )}

          {/* 2 stacked secondary */}
          <div className="flex flex-col">
            {secondary.map(article => (
              <StandardCard key={article.id} article={article} showImage />
            ))}
          </div>
        </div>

        {/* Tertiary row */}
        {tertiary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t mt-0"
            style={{ borderColor: 'var(--border)' }}>
            {tertiary.map((article, i) => (
              <div
                key={article.id}
                className={`${i === 0 && tertiary.length > 1 ? 'md:border-r md:pr-8' : 'md:pl-8'}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <StandardCard article={article} showImage={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
