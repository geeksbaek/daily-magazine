import type { Article } from '../types/magazine'
import SectionHeader from './SectionHeader'
import MagazineArticle from './MagazineArticle'

interface Props {
  id: string
  number: string
  title: string
  subtitle: string
  articles: Article[]
  accentColor?: string
  bgAlternate?: boolean
}

export default function NewsSection({
  id,
  number,
  title,
  subtitle,
  articles,
  accentColor,
  bgAlternate = false,
}: Props) {
  const [featured, ...rest] = articles

  return (
    <section
      id={id}
      className="magazine-section py-16 lg:py-20"
      style={{ backgroundColor: bgAlternate ? 'var(--bg-raised)' : 'var(--bg)' }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <SectionHeader
          number={number}
          title={title}
          subtitle={subtitle}
          color={accentColor}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 lg:gap-10">
          {/* Featured article with magazine layout + SVG wrapping */}
          {featured && (
            <div
              className="border-b pb-8 lg:border-b-0 lg:pb-0 lg:border-r lg:pr-10"
              style={{ borderColor: 'var(--border)' }}
            >
              <MagazineArticle article={featured} variant="standard" />
            </div>
          )}

          {/* Side articles — compact magazine cards */}
          <div className="flex flex-col">
            {rest.slice(0, 3).map(article => (
              <MagazineArticle
                key={article.id}
                article={article}
                variant="compact"
                showDecoration={false}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
