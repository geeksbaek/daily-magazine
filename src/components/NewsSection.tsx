import type { Article } from '../types/magazine'
import SectionShell from './SectionShell'
import ArticleRow from './ArticleRow'

interface Props {
  id: string
  title: string
  subtitle?: string
  articles: Article[]
}

export default function NewsSection({ id, title, subtitle, articles }: Props) {
  if (!articles || articles.length === 0) return null
  return (
    <SectionShell id={id} title={title} subtitle={subtitle} count={articles.length}>
      <div className="-mb-7">
        {articles.map(a => <ArticleRow key={a.id} article={a} />)}
      </div>
    </SectionShell>
  )
}
