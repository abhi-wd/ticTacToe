

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

/**
 * rpc_update_username: Synchronises the client's display name with their Nakama account
 * and ensures their existing leaderboard entry (if any) is updated with the new name.
 */
let rpcUpdateUsername: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  let parsed: { username?: string } = {};
  try {
    parsed = JSON.parse(payload);
  } catch (e) {
    logger.error('Payload parse failed');
    throw new Error('Invalid payload');
  }

  if (!parsed.username) {
    return JSON.stringify({ success: false, error: 'No username provided' });
  }

  try {
    const userId = ctx.userId;
    if (!userId) {
      throw new Error('User ID not found in context');
    }
    const username = parsed.username as string;

    // 1. Update the user account username
    nk.accountUpdateId(userId, username);
    logger.info(`Updated username for user ${userId} to ${username}`);

    // 2. Refresh the leaderboard record if it exists to show the new name immediately
    const records = nk.leaderboardRecordsList(LEADERBOARD_ID, [userId], 1);
    if (records.records && records.records.length > 0) {
      const r = records.records[0];
      nk.leaderboardRecordWrite(
        LEADERBOARD_ID,
        userId,
        username,
        r.score,
        r.subscore,
        r.metadata,
        nkruntime.OverrideOperator.SET
      );
      logger.info(`Synced leaderboard name for ${userId}`);
    }
  } catch (e) {
    logger.error(`Failed to update username: ${e}`);
    return JSON.stringify({ success: false, error: String(e) });
  }

  return JSON.stringify({ success: true });
};

/**
 * rpc_migrate_leaderboard: One-time migration to fix existing UUID usernames 
 * for the top 100 players currently on the leaderboard.
 */
let rpcMigrateLeaderboard: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  try {
    const records = nk.leaderboardRecordsList(LEADERBOARD_ID, undefined, 100);
    if (!records.records || records.records.length === 0) {
      return JSON.stringify({ success: true, message: 'No records to migrate' });
    }

    const playerIds = records.records.map(r => r.ownerId);
    const users = nk.usersGetId(playerIds);
    const usersMap: { [id: string]: string } = {};
    users.forEach(u => { usersMap[u.userId] = u.username; });

    let count = 0;
    records.records.forEach(r => {
      const realUsername = usersMap[r.ownerId];
      if (realUsername && realUsername !== r.username) {
        nk.leaderboardRecordWrite(
          LEADERBOARD_ID,
          r.ownerId,
          realUsername,
          r.score,
          r.subscore,
          r.metadata,
          nkruntime.OverrideOperator.SET
        );
        count++;
      }
    });

    logger.info(`Migration complete: ${count} records updated.`);
    return JSON.stringify({ success: true, updated: count });
  } catch (e) {
    logger.error(`Migration failed: ${e}`);
    return JSON.stringify({ success: false, error: String(e) });
  }
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
  initializer.registerRpc("rpc_update_username", rpcUpdateUsername);
  initializer.registerRpc("rpc_migrate_leaderboard", rpcMigrateLeaderboard);

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
