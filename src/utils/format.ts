export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatIssueDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}.${month}.${day}`
}

export function timeAgo(isoString: string): string {
  const now = new Date()
  const past = new Date(isoString)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)

  if (diffMins < 1) return '방금 전'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  return `${Math.floor(diffHours / 24)}일 전`
}

export function formatMetric(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}
