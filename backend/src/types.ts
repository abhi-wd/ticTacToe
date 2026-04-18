// Shared types between match handler modules

/** OpCodes define the type of message being sent between client and server */
enum OpCode {
  /** Server → Client: full authoritative board state after every move */
  UPDATE_STATE = 1,
  /** Client → Server: player intent to place a mark at a board position */
  MAKE_MOVE = 2,
  /** Server → Client: match has ended (winner or draw) */
  GAME_OVER = 3,
  /** Server → Client: opponent disconnected */
  OPPONENT_LEFT = 4,
  /** Server → Client: waiting for a second player */
  WAITING = 5,
  /** Client ↔ Server: in-game floating emotion broadcast */
  EMOTE = 6,
}

/** The board is a flat 9-element array. Index layout:
 *  0 | 1 | 2
 *  ---------
 *  3 | 4 | 5
 *  ---------
 *  6 | 7 | 8
 */
type Mark = "X" | "O";

interface MatchState {
  /** Flat 9-cell board: null = empty, "X"/"O" = taken */
  board: Array<Mark | null>;
  /** Maps userId → their assigned mark */
  marks: Record<string, Mark>;
  /** userId of the player whose turn it currently is */
  turn: string;
  /** Whether the game has started (2 players joined) */
  started: boolean;
  /** userId of the winner, or null if game is not over */
  winner: string | null;
  /** True if the game ended in a draw */
  isDraw: boolean;
  /** Timestamp (ms) of the last move — used for turn timer */
  lastMoveAt: number;
  /** Connected presences (userId → presence) */
  presences: Record<string, nkruntime.Presence>;
  /** The mode of the game */
  mode: 'classic' | 'timed';
}

/** Payload sent from client when making a move */
interface MakeMovePayload {
  position: number; // 0–8
}

/** Payload broadcast to both clients after a state change */
interface UpdateStatePayload {
  board: Array<Mark | null>;
  marks: Record<string, Mark>;
  turn: string;
  started: boolean;
  winner: string | null;
  isDraw: boolean;
  lastMoveAt: number;
  mode: 'classic' | 'timed';
}

/** Payload broadcast when the game ends */
interface GameOverPayload {
  winner: string | null; // userId, or null for draw
  isDraw: boolean;
  board: Array<Mark | null>;
}

/** The 8 possible winning lines on a Tic-Tac-Toe board */
const WIN_LINES: number[][] = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left col
  [1, 4, 7], // middle col
  [2, 5, 8], // right col
  [0, 4, 8], // diagonal \
  [2, 4, 6], // diagonal /
];

/** Auto-forfeit if a timed player doesn't move within this many milliseconds */
const TURN_TIMEOUT_MS = 30_000;

/** Nakama leaderboard ID for tracking wins */
const LEADERBOARD_ID = "tictactoe_wins";
