import { useState, useRef, useEffect } from 'react'
import type { Magazine } from '../types/magazine'

interface Props {
  podcast: NonNullable<Magazine['podcast']>
  date: string
}

const BAR_COUNT = 54
const HEIGHTS = [0.35, 0.72, 0.88, 0.5, 0.78, 0.42, 0.65, 0.95, 0.48, 0.73, 0.3, 0.82, 0.6, 0.38, 0.9, 0.55, 0.7, 0.32, 0.85, 0.62]

function barHeight(i: number) {
  return HEIGHTS[i % HEIGHTS.length]
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PodcastPlayer({ podcast, date }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrubRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(podcast.duration)

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
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      await a.play()
      setPlaying(true)
    }
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
    <section
      className="relative overflow-hidden magazine-section"
      style={{ backgroundColor: '#080806' }}
    >
      <style>{`
        @keyframes podcast-wv {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.22); }
        }
      `}</style>

      {/* Grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      {/* Accent top line */}
      <div
        className="absolute top-0 inset-x-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,51,85,0.25) 30%, rgba(255,51,85,0.45) 50%, rgba(255,51,85,0.25) 70%, transparent 100%)',
        }}
      />

      {/* Radial glow bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: '700px',
          height: '180px',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255,51,85,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-10 py-14 lg:py-20">

        {/* Section header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: '#FF3355',
                boxShadow: playing ? '0 0 6px rgba(255,51,85,0.8)' : 'none',
                transition: 'box-shadow 0.3s ease',
              }}
            />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: '#FF3355' }}>
              오늘의 팟캐스트
            </span>
          </div>
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,51,85,0.1)' }} />
          <span className="font-mono text-[10px] tracking-widest" style={{ color: 'rgba(255,255,255,0.18)' }}>
            {date}
          </span>
        </div>

        {/* Player card */}
        <div
          className="relative border"
          style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.015)' }}
        >
          {/* Corner accent */}
          <div
            className="absolute top-0 left-0 w-10 h-10 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,51,85,0.15) 0%, transparent 60%)',
            }}
          />

          <div className="relative p-6 lg:p-10">

            {/* Episode info */}
            <div className="mb-8 lg:mb-10">
              <p
                className="font-mono text-[9px] tracking-[0.35em] uppercase mb-3"
                style={{ color: 'rgba(255,255,255,0.22)' }}
              >
                GEEK/DAILY · AI &amp; TECH NEWS · DAILY BRIEFING
              </p>
              <h3
                className="font-serif font-black text-white"
                style={{
                  fontSize: 'clamp(20px, 2.8vw, 34px)',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                }}
              >
                오늘의 테크 브리핑
              </h3>
            </div>

            {/* Waveform bars */}
            <div
              className="flex items-end gap-[2px] mb-8"
              style={{ height: '52px' }}
            >
              {Array.from({ length: BAR_COUNT }, (_, i) => {
                const h = barHeight(i)
                const isPast = (i / BAR_COUNT) < prog
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h * 100}%`,
                      borderRadius: '1px',
                      transformOrigin: 'bottom center',
                      backgroundColor: isPast ? '#FF3355' : 'rgba(255,255,255,0.11)',
                      opacity: isPast ? (0.55 + h * 0.45) : (0.25 + h * 0.35),
                      animation: playing
                        ? `podcast-wv ${0.65 + (i % 9) * 0.11}s ease-in-out infinite`
                        : 'none',
                      animationDelay: `${(i % 13) * 0.055}s`,
                    }}
                  />
                )
              })}
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-5 lg:gap-7">

              {/* Play / Pause */}
              <button
                onClick={toggle}
                aria-label={playing ? '일시정지' : '재생'}
                className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: '#FF3355',
                  boxShadow: playing
                    ? '0 0 0 5px rgba(255,51,85,0.14), 0 0 24px rgba(255,51,85,0.28)'
                    : '0 0 0 0px rgba(255,51,85,0)',
                  transition: 'box-shadow 0.3s ease, transform 0.12s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.06)')}
              >
                {playing ? (
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                    <rect x="0.5" y="0.5" width="4" height="13" rx="0.5" fill="white" />
                    <rect x="7.5" y="0.5" width="4" height="13" rx="0.5" fill="white" />
                  </svg>
                ) : (
                  <svg width="13" height="14" viewBox="0 0 13 14" fill="none" style={{ marginLeft: '2px' }}>
                    <path d="M1.5 1L11.5 7L1.5 13V1Z" fill="white" />
                  </svg>
                )}
              </button>

              {/* Scrubber + time */}
              <div className="flex-1 flex flex-col gap-2.5">
                <div
                  ref={scrubRef}
                  onClick={seek}
                  className="relative cursor-pointer group"
                  style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute left-0 top-0 h-full"
                    style={{ width: `${prog * 100}%`, backgroundColor: '#FF3355' }}
                  />
                  {/* Handle dot */}
                  <div
                    className="absolute top-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-3 h-3 rounded-full"
                    style={{
                      left: `${prog * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: '#FF3355',
                      boxShadow: '0 0 8px rgba(255,51,85,0.6)',
                    }}
                  />
                </div>

                <div className="flex justify-between items-baseline">
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                  >
                    {fmt(time)}
                  </span>
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    {fmt(dur)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={podcast.url} preload="metadata" />
    </section>
  )
}
