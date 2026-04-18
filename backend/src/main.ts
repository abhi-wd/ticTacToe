

let matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, matches: nkruntime.MatchmakerResult[]): string | void {
  logger.info(`Matchmaker matched ${matches.length} players — creating match`);
  try {
    const p1 = matches[0];
    const mode = p1.properties?.["mode"] === "timed" ? "timed" : "classic";
    const matchId = nk.matchCreate("tictactoe", { mode });
    logger.info(`Match created: ${matchId} (Mode: ${mode})`);
    return matchId;
  } catch (e) {
    logger.error(`Failed to create match: ${e}`);
    return;
  }
};

// Room Code Generator
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  // 5 chars
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';

let rpcCreateRoom: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  const matchId = nk.matchCreate('tictactoe', { mode: 'classic', private: true });
  const code = generateRoomCode();
  
  nk.storageWrite([{
    collection: 'room_codes',
    key: code,
    userId: SYSTEM_USER,
    value: { matchId },
    permissionRead: 2, // public
    permissionWrite: 0,
  }]);

  logger.info(`Private match created: ${matchId} with code: ${code}`);
  return JSON.stringify({ matchId, code });
};

let rpcJoinRoom: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  let parsed: { code?: string } = {};
  try {
    parsed = JSON.parse(payload);
  } catch(e) {}
  
  if (!parsed.code || parsed.code.length !== 5) {
    throw new Error('Invalid room code length');
  }

  const code = parsed.code.toUpperCase().trim();
  const records = nk.storageRead([{
    collection: 'room_codes',
    key: code,
    userId: SYSTEM_USER
  }]);

  if (!records || records.length === 0) {
    throw new Error('Room not found or expired');
  }

  return JSON.stringify({ matchId: records[0].value.matchId });
};

let InitModule: nkruntime.InitModule = function(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  logger.info("Initialising TicTacToe server module");

  // Register the match handler
  initializer.registerMatch("tictactoe", {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLoop,
    matchLeave,
    matchTerminate,
    matchSignal,
  });

  // Register Custom RPCs
  initializer.registerRpc("rpc_create_room", rpcCreateRoom);
  initializer.registerRpc("rpc_join_room", rpcJoinRoom);

  // Create the leaderboard (idempotent — safe to call on every startup)
  try {
    nk.leaderboardCreate(
      LEADERBOARD_ID,
      false,        // not authoritative (client can read)
      nkruntime.SortOrder.DESCENDING, // sort order: highest wins first
      nkruntime.Operator.INCREMENTAL,   // operator: increment wins
      undefined,    // reset schedule (daily: "0 0 * * *")
      {}            // metadata
    );
    logger.info(`Leaderboard '${LEADERBOARD_ID}' ready`);
  } catch (e) {
    logger.warn(`Leaderboard creation skipped (may already exist): ${e}`);
  }

  // Hook: matchmakerMatched — automatically create a match when 2 players pair
  initializer.registerMatchmakerMatched(matchmakerMatched);

  logger.info("TicTacToe module initialised successfully");
};

// Nakama requires this to be the default export
// @ts-ignore — nkruntime global is injected by the Nakama runtime
!InitModule && InitModule.bind(null);
