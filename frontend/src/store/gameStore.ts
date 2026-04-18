import { create } from 'zustand'
import type { MatchData } from '@heroiclabs/nakama-js'
import type { Socket, Session } from '@heroiclabs/nakama-js'

// ─── Types ────────────────────────────────────────────────────────────────────
export type Mark = 'X' | 'O' | null
export type Phase = 'login' | 'lobby' | 'matchmaking' | 'game' | 'result'

export interface GameState {
  board: Mark[]
  marks: Record<string, 'X' | 'O'>
  turn: string
  started: boolean
  winner: string | null
  isDraw: boolean
  mode: 'classic' | 'timed'
  lastMoveAt: number
}

// ─── OpCodes — must match backend/src/types.ts ────────────────────────────────
export const OpCode = {
  UPDATE_STATE: 1,
  MAKE_MOVE:    2,
  GAME_OVER:    3,
  OPPONENT_LEFT:4,
  WAITING:      5,
  EMOTE:        6,
} as const

export interface ActiveEmote {
  userId: string;
  emoji: string;
  id: number;
}

export const EMOTES = ['👍', '😡', '😂', '🎯'] as const

export const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
] as const

// ─── Store ────────────────────────────────────────────────────────────────────
interface Store {
  // Auth
  session:    Session | null
  socket:     Socket  | null
  myUserId:   string

  // Match
  matchId:    string
  matchToken: string | null
  phase:      Phase

  // Game
  board:    Mark[]
  marks:    Record<string, 'X' | 'O'>
  turn:     string
  started:  boolean
  winner:   string | null
  isDraw:   boolean
  winCells: number[]
  mode:     'classic' | 'timed'
  lastMoveAt: number
  activeEmote: ActiveEmote | null
  roomCode: string | null

  // Actions
  setAuth:             (session: Session, socket: Socket) => void
  setMatchmakerResult: (matchId: string | null, token: string | null) => void
  setPhase:            (phase: Phase) => void
  sendMove:            (position: number) => void
  sendEmote:           (emoji: string) => void
  setRoomCode:         (code: string | null) => void
  reset:               () => void
  applyServerMessage:  (data: MatchData) => void
}

const INITIAL_BOARD: Mark[] = Array(9).fill(null)

function findWinCells(board: Mark[], marks: Record<string, 'X' | 'O'>, winner: string): number[] {
  const wm = marks[winner]
  if (!wm) return []
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] === wm && board[b] === wm && board[c] === wm) return [a, b, c]
  }
  return []
}

export const useGameStore = create<Store>((set, get) => ({
  session:    null,
  socket:     null,
  myUserId:   '',
  matchId:    '',
  matchToken: null,
  phase:      'login',
  board:      [...INITIAL_BOARD],
  marks:      {},
  turn:       '',
  started:    false,
  winner:     null,
  isDraw:     false,
  winCells:   [],
  mode:       'classic',
  lastMoveAt: 0,
  activeEmote: null,
  roomCode:   null,

  setAuth: (session, socket) =>
    set({ session, socket, myUserId: session.user_id ?? '', phase: 'lobby' }),

  setMatchmakerResult: (matchId, token) =>
    set({ matchId: matchId ?? '', matchToken: token, phase: 'matchmaking' }),

  setPhase: (phase) => set({ phase }),

  setRoomCode: (code) => set({ roomCode: code }),

  sendMove: (position) => {
    const { socket, matchId } = get()
    if (!socket || !matchId) return
    socket.sendMatchState(matchId, OpCode.MAKE_MOVE, JSON.stringify({ position }))
  },

  sendEmote: (emoji) => {
    const { socket, matchId, myUserId } = get()
    if (!socket || !matchId) return

    // Show locally immediately
    const id = Date.now()
    set({ activeEmote: { userId: myUserId, emoji, id } })
    setTimeout(() => {
      if (get().activeEmote?.id === id) set({ activeEmote: null })
    }, 2500)

    const emoteIndex = EMOTES.indexOf(emoji as any)
    if (emoteIndex === -1) return

    try {
      socket.sendMatchState(matchId, OpCode.EMOTE, JSON.stringify({ emoteIndex, userId: myUserId }))
    } catch (e) {}
  },

  reset: () =>
    set({
      matchId: '', matchToken: null, phase: 'lobby',
      board: [...INITIAL_BOARD], marks: {}, turn: '',
      started: false, winner: null, isDraw: false, winCells: [],
      mode: 'classic', lastMoveAt: 0, activeEmote: null, roomCode: null,
    }),

  applyServerMessage: (data: MatchData) => {
    const raw = new TextDecoder().decode(data.data as Uint8Array)
    let payload: unknown
    try { payload = JSON.parse(raw) } catch { return }

    switch (data.op_code) {
      case OpCode.WAITING:
        set({ started: false })
        break

      case OpCode.EMOTE: {
        const e = payload as { emoteIndex?: number, userId?: string }
        if (e.emoteIndex === undefined || e.emoteIndex < 0 || e.emoteIndex >= EMOTES.length) break
        const senderId = e.userId || data.presence?.user_id || ''
        // Avoid double-rendering local emotes
        if (senderId === get().myUserId || !senderId) break

        const id = Date.now()
        set({ activeEmote: { userId: senderId, emoji: EMOTES[e.emoteIndex], id } })
        setTimeout(() => {
          if (get().activeEmote?.id === id) set({ activeEmote: null })
        }, 2500)
        break
      }

      case OpCode.UPDATE_STATE: {
        const s = payload as GameState
        const currentPhase = get().phase
        set({
          board:   s.board,
          marks:   s.marks,
          turn:    s.turn,
          started: s.started,
          winner:  s.winner,
          isDraw:  s.isDraw,
          mode:    s.mode,
          lastMoveAt: s.lastMoveAt,
          phase:   currentPhase === 'result' ? 'result' : (s.started ? 'game' : 'game'),
          matchId: data.match_id ?? get().matchId,
        })
        break
      }

      case OpCode.GAME_OVER: {
        const s = payload as GameState
        const wc = s.winner ? findWinCells(s.board, get().marks, s.winner) : []
        set({
          board:    s.board,
          winner:   s.winner,
          isDraw:   s.isDraw,
          winCells: wc,
        })
        
        // Delay popup by 1.2s to watch win-line animation
        setTimeout(() => {
          set({ phase: 'result' })
        }, 1200)
        break
      }

      case OpCode.OPPONENT_LEFT:
        set({ phase: 'result', winner: get().myUserId, winCells: [] })
        break
    }
  },
}))
