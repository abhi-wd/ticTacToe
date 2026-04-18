import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { leaveMatch } from '../services/nakamaClient'
import Board from '../components/Board'
import GameStatus from '../components/GameStatus'

export default function GameScreen() {
  const navigate = useNavigate()
  const { phase, winner, isDraw, myUserId, mode, sendEmote } = useGameStore()

  // Leave match entirely
  function handleLeave() {
    leaveMatch().catch(() => {})
    navigate('/')
  }

  // Play again (go back to matchmaking)
  function handlePlayAgain() {
    leaveMatch().catch(() => {})
    navigate(`/matchmaking?mode=${mode}`)
  }

  // Helper flags for overlay
  const showResult = phase === 'result'
  const isWinner = winner === myUserId
  const isLoser = winner && winner !== myUserId

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 pb-8 px-4 relative overflow-hidden bg-[#07071a]">
      {/* Background glow behind board */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center -z-10">
        <div className="w-[500px] h-[500px] rounded-full bg-[#7c5cfc]/5 blur-[80px]" />
      </div>

      {/* Header bar */}
      <div className="w-full max-w-[420px] flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-[#ff6b9d]" style={{ textShadow: '0 0 16px rgba(255,107,157,0.5)' }}>✕</span>
          <span className="text-xl font-black text-[#4dd9e0]" style={{ textShadow: '0 0 16px rgba(77,217,224,0.5)' }}>○</span>
          <span className="text-sm font-bold text-[#f0f0ff] uppercase tracking-widest ml-1">Match</span>
        </div>
        <button
          onClick={handleLeave}
          className="text-xs font-semibold text-[#55557a] uppercase tracking-widest hover:text-[#ff5c7a] transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-[#ff5c7a]/30 hover:bg-[#ff5c7a]/10"
        >
          Quit
        </button>
      </div>

      {/* Status Bar */}
      <div className="w-full max-w-[420px] mb-8">
        <GameStatus />
      </div>

      {/* The Grid */}
      <div className="w-full flex-1 flex flex-col items-center justify-center max-h-[60vh] mt-4 mb-8">
        <Board />
      </div>

      {/* Emotes Bar */}
      {phase !== 'result' && (
        <div className="w-full max-w-[420px] flex items-center justify-center gap-5 mt-auto mb-4 animate-slide-up bg-[#0f0f28]/50 py-3 rounded-2xl border border-[#2a2a5a]/50">
          {['👍', '😡', '😂', '🎯'].map(emoji => (
            <button
              key={emoji}
              onClick={() => sendEmote(emoji)}
              className="text-2xl hover:scale-125 transition-transform active:scale-95 bg-[#0f0f28] border border-[#2a2a5a] rounded-full w-12 h-12 flex items-center justify-center drop-shadow-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Footer safe area gap */}
      <div className="h-6 w-full shrink-0" />

      {/* ── Result Overlay ─────────────────────────────────────── */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-pop-in backdrop-blur-sm bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[#0f0f28] border border-[#7c5cfc]/50 rounded-2xl p-8 text-center shadow-[0_0_80px_rgba(124,92,252,0.2)]">
            
            {/* Emoji header */}
            <div className="text-6xl mb-6">
              {isDraw ? '🤝' : isWinner ? '🏆' : '💔'}
            </div>

            {/* Headline */}
            <h2 className={[
              'text-2xl font-black mb-2 tracking-tight',
              isDraw ? 'text-[#f0f0ff]' : isWinner ? 'text-[#4ade80]' : 'text-[#ff5c7a]'
            ].join(' ')}>
              {isDraw ? "It's a Draw!" : isWinner ? "You Win!" : "You Lose!"}
            </h2>
            
            {/* Subtext */}
            <p className="text-sm text-[#9090c0] mb-8">
              {isDraw 
                ? "A well-fought battle." 
                : isWinner 
                  ? "Flawless victory." 
                  : "Better luck next time."}
            </p>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handlePlayAgain}
                className="w-full py-4 rounded-xl font-bold text-white text-base transition-all duration-200 active:scale-95"
                style={{
                  background: 'linear-gradient(180deg, #9d7fff 0%, #7c5cfc 100%)',
                  boxShadow: '0 4px 24px rgba(124,92,252,0.3)',
                }}
              >
                Play Again
              </button>
              
              <button
                onClick={handleLeave}
                className="w-full py-3.5 rounded-xl font-semibold text-[#9090c0] bg-transparent border border-[#2a2a5a] hover:border-[#4a3f9a] hover:text-[#f0f0ff] transition-all"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
