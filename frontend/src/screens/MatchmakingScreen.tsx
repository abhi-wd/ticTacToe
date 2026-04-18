import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { MatchmakerMatched } from '@heroiclabs/nakama-js'
import { startMatchmaking, cancelMatchmaking, joinMatch } from '../services/nakamaClient'
import { useGameStore } from '../store/gameStore'

export default function MatchmakingScreen() {
  const navigate = useNavigate()
  const { socket, setMatchmakerResult, setPhase, phase } = useGameStore()
  const ticketRef   = useRef<string>('')
  const [searchParams] = useSearchParams()
  const modeParam = searchParams.get('mode')
  const mode = modeParam === 'timed' ? 'timed' : modeParam === 'private' ? 'private' : 'classic'
  const privateMatchId = searchParams.get('matchId')
  const privateCode = searchParams.get('code')
  const [dots, setDots] = useState('.')
  const [error, setError] = useState('')

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600)
    return () => clearInterval(id)
  }, [])

  // Start matchmaking on mount, listen for match
  useEffect(() => {
    if (!socket) { navigate('/'); return }

    let cancelled = false

    async function queue() {
      // 1. Private Room
      if (mode === 'private' && privateMatchId) {
        try {
          await joinMatch(null, privateMatchId)
          setPhase('game')
          navigate('/game')
        } catch (e) {
          console.error(e)
          if (!cancelled) setError('Failed to join private match.')
        }
        return
      }

      // 2. Queue matchmaking
      try {
        const ticket = await startMatchmaking(mode as 'classic' | 'timed')
        if (cancelled) {
          // Strict mode or fast unmount: cancel immediately
          cancelMatchmaking(ticket).catch(() => {})
          return
        }
        ticketRef.current = ticket
      } catch {
        if (!cancelled) setError('Failed to enter queue. Is Nakama running?')
        return
      }

      // Listen for matchmaker result
      socket!.onmatchmakermatched = async (matched: MatchmakerMatched) => {
        if (cancelled) return
        socket!.onmatchmakermatched = undefined as never

        const token   = matched.token   ?? null
        const matchId = matched.match_id ?? null
        setMatchmakerResult(matchId, token)

        try {
          await joinMatch(token, matchId ?? '')
          setPhase('game')
          navigate('/game')
        } catch (e) {
          console.error(e)
          if (!cancelled) setError('Failed to join match.')
        }
      }
    }

    queue()

    return () => {
      cancelled = true
      socket!.onmatchmakermatched = undefined as never
      if (ticketRef.current) {
        cancelMatchmaking(ticketRef.current).catch(() => {})
        ticketRef.current = ''
      }
    }
  }, [socket])   // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel() {
    if (ticketRef.current) {
      await cancelMatchmaking(ticketRef.current).catch(() => {})
      ticketRef.current = ''
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#7c5cfc]/10 blur-3xl" />
      </div>

      <div className="w-full max-w-xs text-center animate-slide-up space-y-8">

        {/* Spinner */}
        <div className="flex items-center justify-center">
          <div className="relative w-20 h-20">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-[#2a2a5a]" />
            {/* Spinning arc */}
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#7c5cfc] animate-spin-arc"
              style={{ borderTopColor: '#7c5cfc', borderRightColor: '#9d7fff33' }}
            />
            {/* Inner pulse */}
            <div className="absolute inset-4 rounded-full bg-[#7c5cfc]/20 animate-pulse" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#f0f0ff]">
            {mode === 'private' ? `Joining Room${dots}` : `Finding ${mode} opponent${dots}`}
          </h2>
          {mode === 'private' && privateCode ? (
            <div className="mt-4 bg-[#0f0f28] border border-[#2a2a5a] px-5 py-3 rounded-xl mx-auto w-fit">
              <p className="text-xs text-[#9090c0] uppercase tracking-widest mb-1">Room Code</p>
              <p className="text-3xl font-black text-[#f0f0ff] tracking-[0.2em]">{privateCode}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#9090c0]">
                You'll be matched in seconds
              </p>
              <p className="text-xs text-[#55557a] mt-1">
                Tip: open an incognito window to test with yourself
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="bg-[#ff5c7a]/10 border border-[#ff5c7a]/30 rounded-xl px-4 py-3 text-sm text-[#ff5c7a]">
            ⚠ {error}
          </div>
        )}

        {/* Cancel */}
        <button
          onClick={handleCancel}
          className="w-full py-3 rounded-xl border border-[#2a2a5a] text-sm font-semibold text-[#9090c0] hover:border-[#4a3f9a] hover:text-[#f0f0ff] transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
