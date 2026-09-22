import { formatDate, formatIssueNo } from '../utils/format'
import { Wordmark } from './MagazineNav'

interface Props {
  date: string
  issueNumber: number
  onTop: () => void
  onShowArchive: () => void
}

export default function Footer({ date, issueNumber, onTop, onShowArchive }: Props) {
  return (
    <footer className="border-t border-rule-2">
      <div className="wrap flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Wordmark className="text-[22px]" />
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            {formatIssueNo(issueNumber)}, {formatDate(date)}.<br />
            매일 아침 6시, 전날의 테크 소식을 한국어로 정리해 발행합니다.
          </p>
        </div>
        <div className="flex gap-5 text-[13px]">
          <button type="button" onClick={onShowArchive} className="link-ink text-ink-2">지난 호</button>
          <button type="button" onClick={onTop} className="link-ink text-ink-2">맨 위로</button>
        </div>
      </div>
    </footer>
  )
}
