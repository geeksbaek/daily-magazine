import { useState, useRef, useEffect } from 'react'
import type { Magazine } from '../types/magazine'
import { formatIssueNo } from '../utils/format'

interface Props {
  podcast: NonNullable<Magazine['podcast']>
  issueNumber: number
}

const BAR_COUNT = 48
const HEIGHTS = [0.35, 0.72, 0.88, 0.5, 0.78, 0.42, 0.65, 0.95, 0.48, 0.73, 0.3, 0.82, 0.6, 0.38, 0.9, 0.55, 0.7, 0.32, 0.85, 0.62]

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Audio briefing for the issue. Sits between the cover and the first section. */
export default function PodcastPlayer({ podcast, issueNumber }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrubRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(podcast.duration)
  const [showScript, setShowScript] = useState(false)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setTime(a.currentTime)
    const onMeta = () => setDur(a.duration)
    const onEnd = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = async () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { await a.play(); setPlaying(true) }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    const el = scrubRef.current
    if (!a || !el) return
    const r = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    a.currentTime = ratio * dur
    setTime(ratio * dur)
  }

  const prog = dur > 0 ? time / dur : 0

  return (
    <section id="podcast" className="wrap scroll-mt-16 py-10 lg:py-14">
      <style>{`@keyframes gd-wave { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.25) } }`}</style>
      <div className="border border-rule bg-paper-2 p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? '일시정지' : '재생'}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-colors hover:bg-accent hover:text-accent-ink"
          >
            {playing ? (
              <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
                <rect x="1" y="1" width="4" height="14" rx="0.5" /><rect x="9" y="1" width="4" height="14" rx="0.5" />
              </svg>
            ) : (
              <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true" style={{ marginLeft: 2 }}>
                <path d="M1 1l12 7-12 7V1Z" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-[20px] font-bold leading-tight text-ink">
                {formatIssueNo(issueNumber)} 오디오 브리핑
              </h2>
              <span className="text-[12.5px] text-ink-3 tabular">{fmt(time)} / {fmt(dur)}</span>
            </div>

            <div ref={scrubRef} onClick={seek} className="group relative mt-4 cursor-pointer py-2" role="slider" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(time)} aria-label="재생 위치">
              <div className="flex h-8 items-end gap-[3px]">
                {Array.from({ length: BAR_COUNT }, (_, i) => {
                  const h = HEIGHTS[i % HEIGHTS.length]
                  const past = i / BAR_COUNT < prog
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-[1px]"
                      style={{
                        height: `${h * 100}%`,
                        transformOrigin: 'bottom',
                        backgroundColor: past ? 'var(--accent)' : 'var(--rule-2)',
                        animation: playing ? `gd-wave ${0.7 + (i % 7) * 0.1}s ease-in-out infinite` : 'none',
                        animationDelay: `${(i % 11) * 0.06}s`,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {podcast.transcript && (
          <div className="mt-5 border-t border-rule pt-4">
            <button type="button" onClick={() => setShowScript(s => !s)} className="text-[13px] font-semibold text-accent" aria-expanded={showScript}>
              {showScript ? '대본 접기' : '대본 보기'}
            </button>
            <div className="expand" data-open={showScript}>
              <div>
                <div className="prose-body max-w-prose pt-3 text-[15px] leading-[1.8] text-ink-2">
                  {podcast.transcript.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <audio ref={audioRef} src={podcast.url} preload="metadata" />
    </section>
  )
}
