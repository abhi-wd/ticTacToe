import type { Mark } from '../store/gameStore'

interface CellProps {
  mark:      Mark
  isWinCell: boolean
  isMyTurn:  boolean
  myMark:    'X' | 'O' | undefined
  onClick:   () => void
}

export default function Cell({ mark, isWinCell, isMyTurn, myMark, onClick }: CellProps) {
  const isEmpty = mark === null

  // Preview ghost mark on hover (desktop only)
  const hoverClass = isMyTurn && isEmpty
    ? myMark === 'X'
      ? 'hover:after:content-["✕"] hover:after:absolute hover:after:inset-0 hover:after:flex hover:after:items-center hover:after:justify-center hover:after:text-5xl hover:after:text-[#ff6b9d]/30 hover:after:font-black'
      : 'hover:after:content-["○"] hover:after:absolute hover:after:inset-0 hover:after:flex hover:after:items-center hover:after:justify-center hover:after:text-5xl hover:after:text-[#4dd9e0]/30 hover:after:font-black'
    : ''

  return (
    <button
      onClick={onClick}
      disabled={!isEmpty || !isMyTurn}
      className={[
        // Base
        'relative aspect-square w-full rounded-2xl',
        'flex items-center justify-center',
        'text-5xl font-black',
        'border transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cfc]',
        // Background
        isWinCell
          ? 'bg-yellow-400/10 border-yellow-400/50 animate-glow-pulse'
          : 'bg-[#0f0f28] border-[#2a2a5a]',
        // Cursor
        isMyTurn && isEmpty ? 'cursor-pointer hover:border-[#4a3f9a] hover:bg-[#16163a]' : 'cursor-default',
        // Ghost hover layer
        'overflow-hidden',
        hoverClass,
      ].join(' ')}
      aria-label={mark ? `Cell ${mark}` : 'Empty cell'}
    >
      {mark && (
        <span
          className={[
            'animate-pop-in select-none leading-none',
            mark === 'X' ? 'text-[#ff6b9d]' : 'text-[#4dd9e0]',
          ].join(' ')}
          style={{
            textShadow: mark === 'X'
              ? '0 0 20px rgba(255,107,157,0.7)'
              : '0 0 20px rgba(77,217,224,0.7)',
          }}
        >
          {mark === 'X' ? '✕' : '○'}
        </span>
      )}
    </button>
  )
}
