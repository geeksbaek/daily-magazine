import type { Article } from '../types/magazine'
import SectionHeader from './SectionHeader'
import MagazineArticle from './MagazineArticle'

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

        {/* Primary: featured article with magazine layout */}
        {featured && (
          <div
            className="pb-10 mb-8 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <MagazineArticle article={featured} variant="featured" />
          </div>
        )}

        {/* Secondary: 2-column magazine layout */}
        {secondary.length > 0 && (
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-0 mb-0"
          >
            {secondary.map((article, i) => (
              <div
                key={article.id}
                className={`py-6 ${
                  i === 0 && secondary.length > 1
                    ? 'lg:border-r lg:pr-8'
                    : 'lg:pl-8'
                }`}
                style={{ borderColor: 'var(--border)' }}
              >
                <MagazineArticle
                  article={article}
                  variant="standard"
                  showDecoration={false}
                />
              </div>
            ))}
          </div>
        )}

        {/* Tertiary row: compact cards */}
        {tertiary.length > 0 && (
          <div
            className="border-t pt-2"
            style={{ borderColor: 'var(--border)' }}
          >
            {tertiary.map(article => (
              <MagazineArticle
                key={article.id}
                article={article}
                variant="compact"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
