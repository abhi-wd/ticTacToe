"use strict";
// Shared types between match handler modules
/** OpCodes define the type of message being sent between client and server */
var OpCode;
(function (OpCode) {
    /** Server → Client: full authoritative board state after every move */
    OpCode[OpCode["UPDATE_STATE"] = 1] = "UPDATE_STATE";
    /** Client → Server: player intent to place a mark at a board position */
    OpCode[OpCode["MAKE_MOVE"] = 2] = "MAKE_MOVE";
    /** Server → Client: match has ended (winner or draw) */
    OpCode[OpCode["GAME_OVER"] = 3] = "GAME_OVER";
    /** Server → Client: opponent disconnected */
    OpCode[OpCode["OPPONENT_LEFT"] = 4] = "OPPONENT_LEFT";
    /** Server → Client: waiting for a second player */
    OpCode[OpCode["WAITING"] = 5] = "WAITING";
    /** Client ↔ Server: in-game floating emotion broadcast */
    OpCode[OpCode["EMOTE"] = 6] = "EMOTE";
})(OpCode || (OpCode = {}));
/** The 8 possible winning lines on a Tic-Tac-Toe board */
var WIN_LINES = [
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
var TURN_TIMEOUT_MS = 30000;
/** Nakama leaderboard ID for tracking wins */
var LEADERBOARD_ID = "tictactoe_wins";
// ---------------------------------------------------------------------------
// Helper: check win condition
// ---------------------------------------------------------------------------
function checkWinner(board) {
    for (var _i = 0, WIN_LINES_1 = WIN_LINES; _i < WIN_LINES_1.length; _i++) {
        var _a = WIN_LINES_1[_i], a = _a[0], b = _a[1], c = _a[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// Helper: update stats in storage and leaderboard
// ---------------------------------------------------------------------------
function updateStats(nk, logger, playerIds, winner) {
    var _a, _b, _c;
    try {
        if (playerIds.length === 0)
            return;
        var usersMap_1 = {};
        try {
            var users = nk.usersGetId(playerIds);
            users.forEach(function (u) { usersMap_1[u.userId] = u.username; });
        }
        catch (e) {
            logger.warn("Failed to fetch users for stats: ".concat(e));
        }
        var readReqs = playerIds.map(function (userId) { return ({
            collection: "stats",
            key: "tictactoe",
            userId: userId,
        }); });
        var records = nk.storageRead(readReqs);
        var writeReqs = [];
        var _loop_1 = function (userId) {
            var record = records.find(function (r) { return r.userId === userId; });
            var stats = { wins: 0, losses: 0, streak: 0 };
            if (record === null || record === void 0 ? void 0 : record.value) {
                stats.wins = (_a = record.value.wins) !== null && _a !== void 0 ? _a : 0;
                stats.losses = (_b = record.value.losses) !== null && _b !== void 0 ? _b : 0;
                stats.streak = (_c = record.value.streak) !== null && _c !== void 0 ? _c : 0;
            }
            if (winner === null) {
                stats.streak = 0;
            }
            else if (winner === userId) {
                stats.wins++;
                stats.streak++;
            }
            else {
                stats.losses++;
                stats.streak = 0;
            }
            writeReqs.push({
                collection: "stats",
                key: "tictactoe",
                userId: userId,
                value: stats,
                permissionRead: 2,
                permissionWrite: 0,
            });
            try {
                var username = usersMap_1[userId] || userId;
                nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, username, stats.wins, 0, { losses: stats.losses, streak: stats.streak }, "set" /* nkruntime.OverrideOperator.SET */);
            }
            catch (e) {
                logger.warn("Stats leaderboard write failed: ".concat(e));
            }
        };
        for (var _i = 0, playerIds_1 = playerIds; _i < playerIds_1.length; _i++) {
            var userId = playerIds_1[_i];
            _loop_1(userId);
        }
        if (writeReqs.length > 0) {
            nk.storageWrite(writeReqs);
        }
    }
    catch (e) {
        logger.error("Error updating stats: ".concat(e));
    }
}
// ---------------------------------------------------------------------------
// Helper: broadcast full state to all presences
// ---------------------------------------------------------------------------
function broadcastState(dispatcher, state) {
    var payload = {
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
var matchInit = function (_ctx, logger, _nk, _params) {
    logger.info("TicTacToe match initialised");
    var mode = _params["mode"] === "timed" ? "timed" : "classic";
    var state = {
        board: new Array(9).fill(null),
        marks: {},
        turn: "",
        started: false,
        winner: null,
        isDraw: false,
        lastMoveAt: Date.now(),
        presences: {},
        mode: mode,
    };
    return {
        state: state,
        tickRate: 1, // 1 tick per second — sufficient for turn-based game
        label: "TicTacToe",
    };
};
// ---------------------------------------------------------------------------
// matchJoinAttempt — Called to determine if a player can join
// ---------------------------------------------------------------------------
var matchJoinAttempt = function (_ctx, _logger, _nk, _dispatcher, _tick, state, _presence, _metadata) {
    // Allow if less than 2 players
    var accept = Object.keys(state.presences).length < 2 || state.presences[_presence.userId] !== undefined;
    return { state: state, accept: accept };
};
// ---------------------------------------------------------------------------
// matchJoin — Called each time a player joins
// ---------------------------------------------------------------------------
var matchJoin = function (_ctx, logger, _nk, dispatcher, _tick, state, presences) {
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        state.presences[presence.userId] = presence;
        // Assign marks: first arrival = X, second = O
        var existingMarks = Object.values(state.marks);
        if (!state.marks[presence.userId]) {
            state.marks[presence.userId] = existingMarks.length === 0 ? "X" : "O";
        }
        logger.info("Player ".concat(presence.userId, " joined as ").concat(state.marks[presence.userId]));
    }
    var playerCount = Object.keys(state.presences).length;
    if (playerCount === 1) {
        // Notify the first player they're waiting
        dispatcher.broadcastMessage(OpCode.WAITING, JSON.stringify({ message: "Waiting for opponent..." }));
    }
    if (playerCount === 2 && !state.started) {
        // Game can begin — randomly decide who goes first
        var playerIds = Object.keys(state.presences);
        state.turn = playerIds[Math.floor(Math.random() * playerIds.length)];
        state.started = true;
        state.lastMoveAt = Date.now();
        logger.info("Game starting! First turn: ".concat(state.turn));
        broadcastState(dispatcher, state);
    }
    else if (state.started) {
        // If a player reconnects (or React Strict Mode remounts), send them the current state
        broadcastState(dispatcher, state);
    }
    return { state: state };
};
// ---------------------------------------------------------------------------
// matchLoop — Called every tick; processes incoming messages
// ---------------------------------------------------------------------------
var matchLoop = function (_ctx, logger, nk, dispatcher, _tick, state, messages) {
    var _a, _b, _c, _d;
    // If game hasn't started yet, nothing to process
    if (!state.started)
        return { state: state };
    // ---------------------------------------------------
    // Turn timer: auto-forfeit if timed mode and player exceeds 30s
    // ---------------------------------------------------
    if (state.mode === 'timed' && !state.winner && !state.isDraw) {
        var elapsed = Date.now() - state.lastMoveAt;
        if (elapsed >= TURN_TIMEOUT_MS && state.turn) {
            var loser_1 = state.turn;
            var playerIds = Object.keys(state.presences);
            var winner = (_a = playerIds.find(function (id) { return id !== loser_1; })) !== null && _a !== void 0 ? _a : null;
            logger.info("Player ".concat(loser_1, " forfeited due to timeout"));
            state.winner = winner;
            state.isDraw = false;
            updateStats(nk, logger, playerIds, winner);
            var gameOverPayload = {
                winner: winner,
                isDraw: false,
                board: state.board,
            };
            dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(gameOverPayload));
            return { state: state };
        }
    }
    var _loop_2 = function (message) {
        if (message.opCode === OpCode.EMOTE) {
            // Broadcast simple string payload straight to opponents securely
            dispatcher.broadcastMessage(OpCode.EMOTE, nk.binaryToString(message.data), null, message.sender, true);
            return "continue";
        }
        if (message.opCode !== OpCode.MAKE_MOVE)
            return "continue";
        var senderId = message.sender.userId;
        // Guard: game already over
        if (state.winner || state.isDraw) {
            logger.warn("".concat(senderId, " sent move but game is already over"));
            return "continue";
        }
        // Guard: not this player's turn
        if (senderId !== state.turn) {
            logger.warn("".concat(senderId, " tried to move out of turn"));
            return "continue";
        }
        var payload = void 0;
        try {
            payload = JSON.parse(nk.binaryToString(message.data));
        }
        catch (_e) {
            logger.warn("Invalid move payload from ".concat(senderId));
            return "continue";
        }
        var position = payload.position;
        // Guard: out-of-range position
        if (position < 0 || position > 8) {
            logger.warn("".concat(senderId, " sent invalid position ").concat(position));
            return "continue";
        }
        // Guard: cell already occupied
        if (state.board[position] !== null) {
            logger.warn("".concat(senderId, " tried to occupy filled cell ").concat(position));
            return "continue";
        }
        // Apply move
        var mark = state.marks[senderId];
        state.board[position] = mark;
        state.lastMoveAt = Date.now();
        logger.info("".concat(senderId, " placed ").concat(mark, " at position ").concat(position));
        // Check win
        var winnerMark = checkWinner(state.board);
        if (winnerMark) {
            // Find userId for winning mark
            var winnerUserId = (_c = (_b = Object.entries(state.marks).find(function (_a) {
                var m = _a[1];
                return m === winnerMark;
            })) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : null;
            state.winner = winnerUserId;
            broadcastState(dispatcher, state);
            updateStats(nk, logger, Object.keys(state.marks), winnerUserId);
            var gameOverPayload = {
                winner: winnerUserId,
                isDraw: false,
                board: state.board,
            };
            dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(gameOverPayload));
            logger.info("Game over! Winner: ".concat(winnerUserId));
            return { value: { state: state } };
        }
        // Check draw (all 9 cells filled, no winner)
        if (state.board.every(function (cell) { return cell !== null; })) {
            state.isDraw = true;
            broadcastState(dispatcher, state);
            updateStats(nk, logger, Object.keys(state.marks), null);
            var gameOverPayload = {
                winner: null,
                isDraw: true,
                board: state.board,
            };
            dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(gameOverPayload));
            logger.info("Game over! Draw.");
            return { value: { state: state } };
        }
        // Advance turn to the other player
        var playerIds = Object.keys(state.presences);
        state.turn = (_d = playerIds.find(function (id) { return id !== senderId; })) !== null && _d !== void 0 ? _d : senderId;
        broadcastState(dispatcher, state);
    };
    // ---------------------------------------------------
    // Process incoming move messages
    // ---------------------------------------------------
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        var state_1 = _loop_2(message);
        if (typeof state_1 === "object")
            return state_1.value;
    }
    return { state: state };
};
// ---------------------------------------------------------------------------
// matchLeave — Called when a player disconnects
// ---------------------------------------------------------------------------
var matchLeave = function (_ctx, logger, _nk, dispatcher, _tick, state, presences) {
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        delete state.presences[presence.userId];
        logger.info("Player ".concat(presence.userId, " left the match"));
    }
    // If a game was in progress and someone left, notify the remaining player
    if (state.started && !state.winner && !state.isDraw) {
        dispatcher.broadcastMessage(OpCode.OPPONENT_LEFT, JSON.stringify({ message: "Your opponent disconnected. You win!" }));
        // Award win to remaining player
        var remainingId = Object.keys(state.presences)[0];
        if (remainingId) {
            state.winner = remainingId;
            updateStats(_nk, logger, Object.keys(state.marks), remainingId);
        }
    }
    return { state: state };
};
// ---------------------------------------------------------------------------
// matchTerminate — Called when the match is being shut down
// ---------------------------------------------------------------------------
var matchTerminate = function (_ctx, logger, _nk, _dispatcher, _tick, state, _graceSeconds) {
    logger.info("TicTacToe match terminated");
    return { state: state };
};
// ---------------------------------------------------------------------------
// matchSignal — Not used, required by interface
// ---------------------------------------------------------------------------
var matchSignal = function (_ctx, _logger, _nk, _dispatcher, _tick, state, data) {
    return { state: state, data: data };
};
var matchmakerMatched = function (ctx, logger, nk, matches) {
    var _a;
    logger.info("Matchmaker matched ".concat(matches.length, " players \u2014 creating match"));
    try {
        var p1 = matches[0];
        var mode = ((_a = p1.properties) === null || _a === void 0 ? void 0 : _a["mode"]) === "timed" ? "timed" : "classic";
        var matchId = nk.matchCreate("tictactoe", { mode: mode });
        logger.info("Match created: ".concat(matchId, " (Mode: ").concat(mode, ")"));
        return matchId;
    }
    catch (e) {
        logger.error("Failed to create match: ".concat(e));
        return;
    }
};
// Room Code Generator
function generateRoomCode() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var result = '';
    // 5 chars
    for (var i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
var SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
var rpcCreateRoom = function (ctx, logger, nk, payload) {
    var matchId = nk.matchCreate('tictactoe', { mode: 'classic', private: true });
    var code = generateRoomCode();
    nk.storageWrite([{
            collection: 'room_codes',
            key: code,
            userId: SYSTEM_USER,
            value: { matchId: matchId },
            permissionRead: 2, // public
            permissionWrite: 0,
        }]);
    logger.info("Private match created: ".concat(matchId, " with code: ").concat(code));
    return JSON.stringify({ matchId: matchId, code: code });
};
var rpcJoinRoom = function (ctx, logger, nk, payload) {
    var parsed = {};
    try {
        parsed = JSON.parse(payload);
    }
    catch (e) { }
    if (!parsed.code || parsed.code.length !== 5) {
        throw new Error('Invalid room code length');
    }
    var code = parsed.code.toUpperCase().trim();
    var records = nk.storageRead([{
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
var rpcUpdateUsername = function (ctx, logger, nk, payload) {
    var parsed = {};
    try {
        parsed = JSON.parse(payload);
    }
    catch (e) {
        logger.error('Payload parse failed');
        throw new Error('Invalid payload');
    }
    if (!parsed.username) {
        return JSON.stringify({ success: false, error: 'No username provided' });
    }
    try {
        var userId = ctx.userId;
        if (!userId) {
            throw new Error('User ID not found in context');
        }
        var username = parsed.username;
        // 1. Update the user account username
        nk.accountUpdateId(userId, username);
        logger.info("Updated username for user ".concat(userId, " to ").concat(username));
        // 2. Refresh the leaderboard record if it exists to show the new name immediately
        var records = nk.leaderboardRecordsList(LEADERBOARD_ID, [userId], 1);
        if (records.records && records.records.length > 0) {
            var r = records.records[0];
            nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, username, r.score, r.subscore, r.metadata, "set" /* nkruntime.OverrideOperator.SET */);
            logger.info("Synced leaderboard name for ".concat(userId));
        }
    }
    catch (e) {
        logger.error("Failed to update username: ".concat(e));
        return JSON.stringify({ success: false, error: String(e) });
    }
    return JSON.stringify({ success: true });
};
/**
 * rpc_migrate_leaderboard: One-time migration to fix existing UUID usernames
 * for the top 100 players currently on the leaderboard.
 */
var rpcMigrateLeaderboard = function (ctx, logger, nk, payload) {
    try {
        var records = nk.leaderboardRecordsList(LEADERBOARD_ID, undefined, 100);
        if (!records.records || records.records.length === 0) {
            return JSON.stringify({ success: true, message: 'No records to migrate' });
        }
        var playerIds = records.records.map(function (r) { return r.ownerId; });
        var users = nk.usersGetId(playerIds);
        var usersMap_2 = {};
        users.forEach(function (u) { usersMap_2[u.userId] = u.username; });
        var count_1 = 0;
        records.records.forEach(function (r) {
            var realUsername = usersMap_2[r.ownerId];
            if (realUsername && realUsername !== r.username) {
                nk.leaderboardRecordWrite(LEADERBOARD_ID, r.ownerId, realUsername, r.score, r.subscore, r.metadata, "set" /* nkruntime.OverrideOperator.SET */);
                count_1++;
            }
        });
        logger.info("Migration complete: ".concat(count_1, " records updated."));
        return JSON.stringify({ success: true, updated: count_1 });
    }
    catch (e) {
        logger.error("Migration failed: ".concat(e));
        return JSON.stringify({ success: false, error: String(e) });
    }
};
var InitModule = function (ctx, logger, nk, initializer) {
    logger.info("Initialising TicTacToe server module");
    // Register the match handler
    initializer.registerMatch("tictactoe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLoop: matchLoop,
        matchLeave: matchLeave,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal,
    });
    // Register Custom RPCs
    initializer.registerRpc("rpc_create_room", rpcCreateRoom);
    initializer.registerRpc("rpc_join_room", rpcJoinRoom);
    initializer.registerRpc("rpc_update_username", rpcUpdateUsername);
    initializer.registerRpc("rpc_migrate_leaderboard", rpcMigrateLeaderboard);
    // Create the leaderboard (idempotent — safe to call on every startup)
    try {
        nk.leaderboardCreate(LEADERBOARD_ID, false, // not authoritative (client can read)
        "descending" /* nkruntime.SortOrder.DESCENDING */, // sort order: highest wins first
        "increment" /* nkruntime.Operator.INCREMENTAL */, // operator: increment wins
        undefined, // reset schedule (daily: "0 0 * * *")
        {} // metadata
        );
        logger.info("Leaderboard '".concat(LEADERBOARD_ID, "' ready"));
    }
    catch (e) {
        logger.warn("Leaderboard creation skipped (may already exist): ".concat(e));
    }
    // Hook: matchmakerMatched — automatically create a match when 2 players pair
    initializer.registerMatchmakerMatched(matchmakerMatched);
    logger.info("TicTacToe module initialised successfully");
};
// Nakama requires this to be the default export
// @ts-ignore — nkruntime global is injected by the Nakama runtime
!InitModule && InitModule.bind(null);
