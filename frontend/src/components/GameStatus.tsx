import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export default function GameStatus() {
  const { turn, started, myUserId, marks, phase, winner, isDraw, mode, lastMoveAt, activeEmote, roomCode } = useGameStore()
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (mode !== 'timed' || !started || phase !== 'game' || winner || isDraw) return
    const id = setInterval(() => {
      const elapsed = Date.now() - lastMoveAt
      const remaining = Math.max(0, 30000 - elapsed)
      setProgress((remaining / 30000) * 100)
    }, 100)
    
    // Initial check right away
    const initialElapsed = Date.now() - lastMoveAt
    setProgress((Math.max(0, 30000 - initialElapsed) / 30000) * 100)

    return () => clearInterval(id)
  }, [mode, started, phase, lastMoveAt])

  const myMark = marks[myUserId]
  const isMyTurn = started && turn === myUserId && phase === 'game' && !winner && !isDraw

  if (!started && phase === 'game') {
    return (
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-[#9090c0] text-sm">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-[#7c5cfc] border-t-transparent animate-spin-arc" />
          Waiting for opponent to join...
        </div>
        {roomCode && (
          <div className="bg-[#0f0f28] border border-[#2a2a5a] px-6 py-4 rounded-2xl mx-auto w-fit shadow-lg shadow-[#7c5cfc]/5">
            <p className="text-xs text-[#55557a] font-bold uppercase tracking-widest mb-1">Room Code</p>
            <p className="text-4xl font-black text-[#f0f0ff] tracking-[0.2em]">{roomCode}</p>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'result') {
    return null // result overlay handles this
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full max-w-[420px] mx-auto">
      {/* My mark chip */}
      <div className="relative">
        {activeEmote?.userId === myUserId && (
          <div key={`emote-${activeEmote.id}`} className="absolute -top-12 left-1/2 -translate-x-1/2 text-3xl animate-bounce drop-shadow-lg z-50">
            {activeEmote.emoji}
          </div>
        )}
        <div
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border',
            myMark === 'X'
              ? 'bg-[#ff6b9d]/10 border-[#ff6b9d]/40 text-[#ff6b9d]'
              : 'bg-[#4dd9e0]/10 border-[#4dd9e0]/40 text-[#4dd9e0]',
          ].join(' ')}
        >
          <span>{myMark === 'X' ? '✕' : '○'}</span>
          <span>You</span>
        </div>
      </div>

      {/* Turn indicator */}
      <div className="flex-1 flex flex-col items-center">
        <div
          className={[
            'w-full text-center text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-300 relative overflow-hidden',
            isMyTurn
              ? 'bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30'
              : 'bg-[#f0f0ff]/5 text-[#9090c0] border border-[#2a2a5a]',
          ].join(' ')}
        >
          {winner || isDraw 
            ? 'Game Over' 
            : isMyTurn ? '⚡ Your turn' : "Opponent's turn"}

          {mode === 'timed' && !winner && !isDraw && (
            <div 
              className="absolute bottom-0 left-0 h-1 bg-current transition-all ease-linear opacity-50"
              style={{ width: `${progress}%`, transitionDuration: '100ms' }}
            />
          )}
        </div>
      </div>

      {/* Opponent chip */}
      <div className="relative">
        {activeEmote !== null && activeEmote.userId !== myUserId && (
          <div key={`emote-${activeEmote.id}`} className="absolute -top-12 left-1/2 -translate-x-1/2 text-3xl animate-bounce drop-shadow-lg z-50">
            {activeEmote.emoji}
          </div>
        )}
        <div
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border',
            myMark !== 'X'
              ? 'bg-[#ff6b9d]/10 border-[#ff6b9d]/40 text-[#ff6b9d]'
              : 'bg-[#4dd9e0]/10 border-[#4dd9e0]/40 text-[#4dd9e0]',
          ].join(' ')}
        >
          <span>{myMark !== 'X' ? '✕' : '○'}</span>
          <span>Opp</span>
        </div>
      </div>
    </div>
  )
}
