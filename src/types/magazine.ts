export interface Article {
  id: string
  title: string
  excerpt: string
  url: string
  source: string
  category: string
  publishedAt: string
  readTime?: number
  imageGradient?: number // 0-7, for deterministic placeholder gradient
}

export interface Tweet {
  id: string
  author: string
  handle: string
  content: string
  url: string
  publishedAt: string
  metrics?: {
    likes: number
    retweets: number
    replies: number
  }
}

export interface Magazine {
  date: string
  issueNumber: number
  cover: {
    mainHeadline: string
    mainExcerpt: string
    headlines: string[]
  }
  highlights: Article[]
  sections: {
    ai_ml: Article[]
    dev_tools: Article[]
    big_tech: Article[]
    twitter_pulse: Tweet[]
    quick_bites: Article[]
  }
}

export interface ArchiveEntry {
  date: string
  issueNumber: number
  mainHeadline: string
  headlines: string[]
}

export interface ArchiveIndex {
  issues: ArchiveEntry[]
}
