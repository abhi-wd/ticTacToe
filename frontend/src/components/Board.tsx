import { useGameStore, type Mark } from '../store/gameStore'
import Cell from './Cell'
import WinLine from './WinLine'

export default function Board() {
  const { board, marks, turn, started, winCells, myUserId, phase, sendMove } = useGameStore()

  const myMark = marks[myUserId]
  const isMyTurn = started && turn === myUserId && phase === 'game'

  function handleCellClick(index: number) {
    if (!isMyTurn) return
    if (board[index] !== null) return
    sendMove(index)
  }

  return (
    <div className="relative w-full max-w-[420px] mx-auto select-none">
      {/* 3×3 grid */}
      <div
        className="grid grid-cols-3 gap-2.5 aspect-square w-full"
        style={{ padding: '12px' }}
      >
        {board.map((mark, i) => (
          <Cell
            key={i}
            mark={mark as Mark}
            isWinCell={winCells.includes(i)}
            isMyTurn={isMyTurn && mark === null}
            myMark={myMark}
            onClick={() => handleCellClick(i)}
          />
        ))}
      </div>

      <WinLine cells={winCells} />
    </div>
  )
}
