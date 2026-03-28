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

export interface RedditPost {
  id: string
  title: string
  originalTitle?: string
  url: string
  subreddit: string
  score: number
  publishedAt: string
}

export interface CommunityPost {
  id: string
  title: string
  url: string
  recommend: number
  views: number
  publishedAt: string
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
    reddit_pulse: RedditPost[]
    community_pulse: CommunityPost[]
    quick_bites: Article[]
  }
  podcast?: {
    url: string      // podcast 파일 경로 (예: "./podcast.mp3")
    duration: number // 초 단위 전체 길이
    transcript: string // 대본 텍스트
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
