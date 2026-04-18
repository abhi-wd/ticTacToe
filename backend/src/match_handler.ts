

// ---------------------------------------------------------------------------
// Helper: check win condition
// ---------------------------------------------------------------------------
function checkWinner(board: Array<Mark | null>): Mark | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Mark;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: update stats in storage and leaderboard
// ---------------------------------------------------------------------------
function updateStats(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  playerIds: string[],
  winner: string | null
): void {
  try {
    if (playerIds.length === 0) return;

    let usersMap: { [userId: string]: string } = {};
    try {
      const users = nk.usersGetId(playerIds);
      users.forEach(u => { usersMap[u.userId] = u.username; });
    } catch (e) {
      logger.warn(`Failed to fetch users for stats: ${e}`);
    }

    const readReqs = playerIds.map((userId) => ({
      collection: "stats",
      key: "tictactoe",
      userId,
    }));
    const records = nk.storageRead(readReqs);

    const writeReqs: nkruntime.StorageWriteRequest[] = [];

    for (const userId of playerIds) {
      const record = records.find((r) => r.userId === userId);
      const stats = { wins: 0, losses: 0, streak: 0 };
      if (record?.value) {
        stats.wins = record.value.wins ?? 0;
        stats.losses = record.value.losses ?? 0;
        stats.streak = record.value.streak ?? 0;
      }

      if (winner === null) {
        stats.streak = 0;
      } else if (winner === userId) {
        stats.wins++;
        stats.streak++;
      } else {
        stats.losses++;
        stats.streak = 0;
      }

      writeReqs.push({
        collection: "stats",
        key: "tictactoe",
        userId,
        value: stats,
        permissionRead: 2,
        permissionWrite: 0,
      });

      try {
        const username = usersMap[userId] || userId;
        nk.leaderboardRecordWrite(
          LEADERBOARD_ID,
          userId,
          username,
          stats.wins,
          0,
          { losses: stats.losses, streak: stats.streak },
          nkruntime.OverrideOperator.SET
        );
      } catch (e) {
        logger.warn(`Stats leaderboard write failed: ${e}`);
      }
    }

    if (writeReqs.length > 0) {
      nk.storageWrite(writeReqs);
    }
  } catch (e) {
    logger.error(`Error updating stats: ${e}`);
  }
}

// ---------------------------------------------------------------------------
// Helper: broadcast full state to all presences
// ---------------------------------------------------------------------------
function broadcastState(
  dispatcher: nkruntime.MatchDispatcher,
  state: MatchState
): void {
  const payload: UpdateStatePayload = {
    board: state.board,
    marks: state.marks,
    turn: state.turn,
    started: state.started,
    winner: state.winner,
    isDraw: state.isDraw,
    lastMoveAt: state.lastMoveAt,
    mode: state.mode,
  };
  dispatcher.broadcastMessage(OpCode.UPDATE_STATE, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// matchInit — Called once when the match is created
// ---------------------------------------------------------------------------
let matchInit: nkruntime.MatchInitFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _params: {[joinMessage: string]: string}
) {
  logger.info("TicTacToe match initialised");

  const mode = _params["mode"] === "timed" ? "timed" : "classic";
  const state: MatchState = {
    board: new Array(9).fill(null),
    marks: {},
    turn: "",
    started: false,
    winner: null,
    isDraw: false,
    lastMoveAt: Date.now(),
    presences: {},
    mode,
  };

  return {
    state,
    tickRate: 1, // 1 tick per second — sufficient for turn-based game
    label: "TicTacToe",
  };
};

// ---------------------------------------------------------------------------
// matchJoinAttempt — Called to determine if a player can join
// ---------------------------------------------------------------------------
let matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  _presence: nkruntime.Presence,
  _metadata: {[key: string]: any}
) {
  // Allow if less than 2 players
  const accept = Object.keys(state.presences).length < 2 || state.presences[_presence.userId] !== undefined;
  return { state, accept };
};

// ---------------------------------------------------------------------------
// matchJoin — Called each time a player joins
// ---------------------------------------------------------------------------
let matchJoin: nkruntime.MatchJoinFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  presences: nkruntime.Presence[]
) {
  for (const presence of presences) {
    state.presences[presence.userId] = presence;

    // Assign marks: first arrival = X, second = O
    const existingMarks = Object.values(state.marks);
    if (!state.marks[presence.userId]) {
      state.marks[presence.userId] = existingMarks.length === 0 ? "X" : "O";
    }

    logger.info(
      `Player ${presence.userId} joined as ${state.marks[presence.userId]}`
    );
  }

  const playerCount = Object.keys(state.presences).length;

  if (playerCount === 1) {
    // Notify the first player they're waiting
    dispatcher.broadcastMessage(
      OpCode.WAITING,
      JSON.stringify({ message: "Waiting for opponent..." })
    );
  }

  if (playerCount === 2 && !state.started) {
    // Game can begin — randomly decide who goes first
    const playerIds = Object.keys(state.presences);
    state.turn = playerIds[Math.floor(Math.random() * playerIds.length)];
    state.started = true;
    state.lastMoveAt = Date.now();

    logger.info(`Game starting! First turn: ${state.turn}`);
    broadcastState(dispatcher, state);
  } else if (state.started) {
    // If a player reconnects (or React Strict Mode remounts), send them the current state
    broadcastState(dispatcher, state);
  }

  return { state };
};

// ---------------------------------------------------------------------------
// matchLoop — Called every tick; processes incoming messages
// ---------------------------------------------------------------------------
let matchLoop: nkruntime.MatchLoopFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  messages: nkruntime.MatchMessage[]
) {
  // If game hasn't started yet, nothing to process
  if (!state.started) return { state };

  // ---------------------------------------------------
  // Turn timer: auto-forfeit if timed mode and player exceeds 30s
  // ---------------------------------------------------
  if (state.mode === 'timed' && !state.winner && !state.isDraw) {
    const elapsed = Date.now() - state.lastMoveAt;
    if (elapsed >= TURN_TIMEOUT_MS && state.turn) {
      const loser = state.turn;
      const playerIds = Object.keys(state.presences);
      const winner = playerIds.find((id) => id !== loser) ?? null;

      logger.info(`Player ${loser} forfeited due to timeout`);

      state.winner = winner;
      state.isDraw = false;

      updateStats(nk, logger, playerIds, winner);

      const gameOverPayload: GameOverPayload = {
        winner,
        isDraw: false,
        board: state.board,
      };
      dispatcher.broadcastMessage(
        OpCode.GAME_OVER,
        JSON.stringify(gameOverPayload)
      );

      return { state };
    }
  }

  // ---------------------------------------------------
  // Process incoming move messages
  // ---------------------------------------------------
  for (const message of messages) {
    if (message.opCode === OpCode.EMOTE) {
      // Broadcast simple string payload straight to opponents securely
      dispatcher.broadcastMessage(
        OpCode.EMOTE,
        nk.binaryToString(message.data),
        null,
        message.sender,
        true
      );
      continue;
    }

    if (message.opCode !== OpCode.MAKE_MOVE) continue;

    const senderId = message.sender.userId;

    // Guard: game already over
    if (state.winner || state.isDraw) {
      logger.warn(`${senderId} sent move but game is already over`);
      continue;
    }

    // Guard: not this player's turn
    if (senderId !== state.turn) {
      logger.warn(`${senderId} tried to move out of turn`);
      continue;
    }

    let payload: MakeMovePayload;
    try {
      payload = JSON.parse(nk.binaryToString(message.data)) as MakeMovePayload;
    } catch {
      logger.warn(`Invalid move payload from ${senderId}`);
      continue;
    }

    const { position } = payload;

    // Guard: out-of-range position
    if (position < 0 || position > 8) {
      logger.warn(`${senderId} sent invalid position ${position}`);
      continue;
    }

    // Guard: cell already occupied
    if (state.board[position] !== null) {
      logger.warn(`${senderId} tried to occupy filled cell ${position}`);
      continue;
    }

    // Apply move
    const mark = state.marks[senderId];
    state.board[position] = mark;
    state.lastMoveAt = Date.now();

    logger.info(`${senderId} placed ${mark} at position ${position}`);

    // Check win
    const winnerMark = checkWinner(state.board);
    if (winnerMark) {
      // Find userId for winning mark
      const winnerUserId =
        Object.entries(state.marks).find(([, m]) => m === winnerMark)?.[0] ??
        null;

      state.winner = winnerUserId;
      broadcastState(dispatcher, state);

      updateStats(nk, logger, Object.keys(state.marks), winnerUserId);

      const gameOverPayload: GameOverPayload = {
        winner: winnerUserId,
        isDraw: false,
        board: state.board,
      };
      dispatcher.broadcastMessage(
        OpCode.GAME_OVER,
        JSON.stringify(gameOverPayload)
      );

      logger.info(`Game over! Winner: ${winnerUserId}`);
      return { state };
    }

    // Check draw (all 9 cells filled, no winner)
    if (state.board.every((cell) => cell !== null)) {
      state.isDraw = true;
      broadcastState(dispatcher, state);

      updateStats(nk, logger, Object.keys(state.marks), null);

      const gameOverPayload: GameOverPayload = {
        winner: null,
        isDraw: true,
        board: state.board,
      };
      dispatcher.broadcastMessage(
        OpCode.GAME_OVER,
        JSON.stringify(gameOverPayload)
      );

      logger.info("Game over! Draw.");
      return { state };
    }

    // Advance turn to the other player
    const playerIds = Object.keys(state.presences);
    state.turn = playerIds.find((id) => id !== senderId) ?? senderId;

    broadcastState(dispatcher, state);
  }

  return { state };
};

// ---------------------------------------------------------------------------
// matchLeave — Called when a player disconnects
// ---------------------------------------------------------------------------
let matchLeave: nkruntime.MatchLeaveFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  presences: nkruntime.Presence[]
) {
  for (const presence of presences) {
    delete state.presences[presence.userId];
    logger.info(`Player ${presence.userId} left the match`);
  }

  // If a game was in progress and someone left, notify the remaining player
  if (state.started && !state.winner && !state.isDraw) {
    dispatcher.broadcastMessage(
      OpCode.OPPONENT_LEFT,
      JSON.stringify({ message: "Your opponent disconnected. You win!" })
    );

    // Award win to remaining player
    const remainingId = Object.keys(state.presences)[0];
    if (remainingId) {
      state.winner = remainingId;
      updateStats(_nk, logger, Object.keys(state.marks), remainingId);
    }
  }

  return { state };
};

// ---------------------------------------------------------------------------
// matchTerminate — Called when the match is being shut down
// ---------------------------------------------------------------------------
let matchTerminate: nkruntime.MatchTerminateFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  _graceSeconds: number
) {
  logger.info("TicTacToe match terminated");
  return { state };
};

// ---------------------------------------------------------------------------
// matchSignal — Not used, required by interface
// ---------------------------------------------------------------------------
let matchSignal: nkruntime.MatchSignalFunction<MatchState> = function(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  _dispatcher: nkruntime.MatchDispatcher,
  _tick: number,
  state: MatchState,
  data: string
) {
  return { state, data };
};


