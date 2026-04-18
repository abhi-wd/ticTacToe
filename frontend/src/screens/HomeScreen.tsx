                                            import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, fetchLeaderboard, createPrivateRoom, joinPrivateRoom } from '../services/nakamaClient'
import { useGameStore } from '../store/gameStore'
import type { LeaderboardRecord } from '@heroiclabs/nakama-js'

export default function HomeScreen() {
  const navigate  = useNavigate()
  const { phase, socket } = useGameStore()
  const [name, setName]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [records, setRecords] = useState<LeaderboardRecord[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [roomError, setRoomError] = useState('')

  // If already authenticated, skip login form and show lobby directly
  const isLoggedIn = phase !== 'login'

  useEffect(() => {
    if (isLoggedIn) {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
      fetchLeaderboard().then(setRecords).catch(() => {})
    }
  }, [isLoggedIn])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(name)
      const records = await fetchLeaderboard()
      setRecords(records)
    } catch {
      setError('Could not connect — is Nakama running?')
    } finally {
      setLoading(false)
    }
  }

  async function handlePlayClassic() {
    navigate('/matchmaking?mode=classic')
  }

  async function handlePlayTimed() {
    navigate('/matchmaking?mode=timed')
  }

  async function handleCreatePrivate() {
    setRoomError('')
    try {
      const res = await createPrivateRoom()
      if (res?.matchId) {
        useGameStore.getState().setRoomCode(res.code)
        navigate(`/matchmaking?mode=private&matchId=${res.matchId}`)
      }
    } catch {
      setRoomError('Failed to create private room.')
    }
  }

  async function handleJoinPrivate(e: React.FormEvent) {
    e.preventDefault()
    setRoomError('')
    if (!roomCode || roomCode.length !== 5) {
      setRoomError('Invalid code.')
      return
    }
    try {
      const matchId = await joinPrivateRoom(roomCode)
      if (matchId) {
        navigate(`/matchmaking?mode=private&matchId=${matchId}`)
      }
    } catch {
      setRoomError('Room not found or expired.')
    }
  }

  const medals = ['🥇', '🥈', '🥉']
  
  const parseMeta = (meta: any) => {
    try {
      return JSON.parse(meta) as { losses?: number; streak?: number; }
    } catch { return {} }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-10 pb-8 px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-[#5030b0]/10 blur-3xl" />
        <div className="absolute top-1/3 -right-16 w-72 h-72 rounded-full bg-[#ff6b9d]/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-[#4dd9e0]/8 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="text-center mb-8 animate-slide-up">
        <div className="flex items-center justify-center gap-4 mb-3">
          <span
            className="text-5xl font-black text-[#ff6b9d]"
            style={{ textShadow: '0 0 24px rgba(255,107,157,0.6)' }}
          >
            ✕
          </span>
          <span
            className="text-5xl font-black text-[#4dd9e0]"
            style={{ textShadow: '0 0 24px rgba(77,217,224,0.6)' }}
          >
            ○
          </span>
        </div>
        <h1 className="text-3xl font-black text-[#f0f0ff] tracking-tight">TicTacToe</h1>
        <p className="text-xs text-[#55557a] mt-1 tracking-widest uppercase">
          Multiplayer · Real-Time · Authoritative
        </p>
      </div>

      {!isLoggedIn ? (
        /* ── Login card ─────────────────────────────────────────────── */
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm animate-slide-up"
          style={{ animationDelay: '60ms' }}
        >
          <div className="bg-[#0f0f28] border border-[#2a2a5a] rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#f0f0ff] mb-1">Enter the Arena</h2>
            <p className="text-sm text-[#9090c0] mb-5">Pick a display name to get started</p>

            <label className="block text-xs font-semibold text-[#55557a] uppercase tracking-widest mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. NightOwl42"
              maxLength={16}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#07071a] border border-[#2a2a5a] rounded-xl px-4 py-3 text-[#f0f0ff] text-sm font-medium placeholder:text-[#35354a] transition-all focus:outline-none focus:border-[#7c5cfc] focus:ring-2 focus:ring-[#7c5cfc]/20 mb-4"
              autoFocus
            />

            {error && (
              <p className="text-xs text-[#ff5c7a] mb-3 flex items-center gap-1.5">
                <span>⚠</span> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 disabled:opacity-60"
              style={{
                background: 'linear-gradient(180deg, #9d7fff 0%, #7c5cfc 100%)',
                boxShadow: '0 4px 24px rgba(124,92,252,0.35)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin-arc" />
                  Connecting...
                </span>
              ) : 'Play Now →'}
            </button>

            <p className="text-xs text-[#35354a] text-center mt-4">
              🔒 Device auth — no password needed
            </p>
          </div>
        </form>
      ) : (
        /* ── Lobby ──────────────────────────────────────────────────── */
        <div className="w-full max-w-sm space-y-4 animate-slide-up">
          <div className="flex gap-3">
            <button
              onClick={handlePlayClassic}
              className="flex-1 py-4 rounded-2xl font-bold text-[#f0f0ff] text-sm transition-all duration-200 active:scale-95 border border-[#2a2a5a] bg-[#0f0f28] hover:border-[#4a3f9a]"
            >
              Play Classic
            </button>
            <button
              onClick={handlePlayTimed}
              className="flex-1 py-4 rounded-2xl font-bold text-white text-sm transition-all duration-200 active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #9d7fff 0%, #7c5cfc 100%)',
                boxShadow: '0 4px 32px rgba(124,92,252,0.45)',
              }}
            >
              ⚡ Timed (30s)
            </button>
          </div>

          {/* Private Room Section */}
          <div className="bg-[#0f0f28] border border-[#2a2a5a] rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-[#f0f0ff] mb-4">🤝 Play with Friend</h3>
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleCreatePrivate}
                className="flex-1 py-3.5 rounded-xl font-bold text-[#f0f0ff] text-sm transition-all border border-[#7c5cfc]/50 hover:bg-[#7c5cfc]/10"
              >
                Create Room
              </button>
            </div>
            
            <form onSubmit={handleJoinPrivate} className="flex gap-2">
              <input
                type="text"
                placeholder="5-Digit Code"
                maxLength={5}
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                className="flex-1 bg-[#07071a] border border-[#2a2a5a] rounded-xl px-4 text-[#f0f0ff] text-sm font-bold placeholder:text-[#35354a] focus:outline-none focus:border-[#4dd9e0]"
              />
              <button
                type="submit"
                className="px-5 py-3.5 rounded-xl font-bold text-[#07071a] text-sm bg-[#4dd9e0] hover:bg-[#3bc2c9] transition-all"
              >
                Join
              </button>
            </form>
            {roomError && (
              <p className="text-xs text-[#ff5c7a] mt-3">⚠ {roomError}</p>
            )}
          </div>

          {/* Leaderboard */}
          <div className="bg-[#0f0f28] border border-[#2a2a5a] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#2a2a5a]">
              <p className="text-xs font-semibold text-[#55557a] uppercase tracking-widest">
                🏆 Top Players
              </p>
            </div>

            {records.length === 0 ? (
              <p className="text-sm text-[#35354a] text-center py-8">
                No records yet — play a match!
              </p>
            ) : (
              <ul className="divide-y divide-[#1a1a38]">
                {records.slice(0, 8).map((r, i) => {
                  const meta = parseMeta(r.metadata)
                  return (
                    <li key={r.owner_id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-base w-6 text-center">
                        {i < 3 ? medals[i] : `${i + 1}.`}
                      </span>
                      <span className={`flex-1 text-sm font-medium truncate ${i < 3 ? 'text-[#f0f0ff]' : 'text-[#9090c0]'}`}>
                        {r.username ?? r.owner_id?.slice(0, 8)}
                      </span>
                      <span className="text-sm font-bold text-[#4ade80]" title="Wins">
                        {r.score}W
                      </span>
                      {meta.losses !== undefined && (
                        <span className="text-sm font-bold text-[#ff5c7a]" title="Losses">
                          {meta.losses}L
                        </span>
                      )}
                      {meta.streak ? (
                        <span className="text-sm font-bold text-[#ffd700]" title="Current Streak">
                          (🔥 {meta.streak})
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-[#1e1e36] mt-auto pt-8">
        Powered by Nakama · React · Tailwind
      </p>
    </div>
  )
}
