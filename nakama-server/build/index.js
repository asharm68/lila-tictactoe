var MODULE_NAME = "tictactoe";
var TICK_RATE = 1;
var LOBBY_KEY = "open_match";
var WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];

function checkWinner(board) {
    for (var i = 0; i < WIN_LINES.length; i++) {
        var a = WIN_LINES[i][0], b = WIN_LINES[i][1], c = WIN_LINES[i][2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    for (var j = 0; j < board.length; j++) { if (board[j] === null) return null; }
    return "draw";
}

function getPlayerCount(state) {
    var count = 0;
    for (var k in state.players) { if (state.players.hasOwnProperty(k)) count++; }
    return count;
}

function getMarkCount(state) {
    var count = 0;
    for (var k in state.marks) { if (state.marks.hasOwnProperty(k)) count++; }
    return count;
}

function getOtherPlayer(state, userId) {
    for (var k in state.players) {
        if (state.players.hasOwnProperty(k) && k !== userId) return k;
    }
    return null;
}

function buildPlayersMap(state) {
    var result = {};
    for (var k in state.players) {
        if (state.players.hasOwnProperty(k)) result[k] = state.players[k].username;
    }
    return result;
}

function updateLeaderboard(nk, logger, userId, username, result) {
    try {
        var scoreMap = { win: 3, draw: 1, loss: 0 };
        nk.leaderboardRecordWrite("global_leaderboard", userId, username, scoreMap[result], 0, { lastResult: result });
    } catch (e) { logger.error("Leaderboard error: " + e); }
}

var matchInit = function(ctx, logger, nk, params) {
    var state = {
        board: [null,null,null,null,null,null,null,null,null],
        marks: {}, turn: "", winner: null,
        players: {}, moveCount: 0, gameOver: false, presences: {}
    };
    logger.info("Match initialized");
    return { state: state, tickRate: TICK_RATE, label: "waiting" };
};

var matchJoinAttempt = function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.gameOver) return { state: state, accept: false, rejectMessage: "Game already over" };
    if (getPlayerCount(state) >= 2) return { state: state, accept: false, rejectMessage: "Match is full" };
    return { state: state, accept: true };
};

var matchJoin = function(ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        state.presences[presence.sessionId] = presence;
        var mark = (getMarkCount(state) === 0) ? "X" : "O";
        state.marks[presence.userId] = mark;
        state.players[presence.userId] = { username: presence.username, presence: presence };
        logger.info("Player " + presence.username + " joined as " + mark);
    }

    if (getPlayerCount(state) === 2) {
        // Clear lobby so no one else tries to join this match
        try {
            nk.storageDelete([{ collection: "lobby", key: LOBBY_KEY, userId: "00000000-0000-0000-0000-000000000000" }]);
        } catch(e) {}

        var xPlayer = null;
        for (var uid in state.marks) {
            if (state.marks.hasOwnProperty(uid) && state.marks[uid] === "X") { xPlayer = uid; break; }
        }
        state.turn = xPlayer;
        dispatcher.broadcastMessage(1, JSON.stringify({
            type: "game_start", board: state.board,
            marks: state.marks, turn: state.turn, players: buildPlayersMap(state)
        }), null, null, true);
        logger.info("Game started!");
    } else {
        dispatcher.broadcastMessage(1, JSON.stringify({
            type: "waiting", message: "Waiting for opponent..."
        }), null, null, true);
    }
    return { state: state };
};

var matchLeave = function(ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        delete state.presences[presence.sessionId];
        if (!state.gameOver) {
            state.gameOver = true;
            var remainingId = getOtherPlayer(state, presence.userId);
            dispatcher.broadcastMessage(1, JSON.stringify({
                type: "game_over", winner: remainingId,
                reason: "opponent_disconnected", board: state.board
            }), null, null, true);
            if (remainingId && state.players[remainingId]) {
                updateLeaderboard(nk, null, remainingId, state.players[remainingId].username, "win");
            }
        }
        delete state.players[presence.userId];
    }
    return { state: state };
};

var matchLoop = function(ctx, logger, nk, dispatcher, tick, state, messages) {
    var presenceCount = 0;
    for (var k in state.presences) { if (state.presences.hasOwnProperty(k)) presenceCount++; }
    if (presenceCount === 0) return null;

    for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        if (msg.opCode !== 2 || state.gameOver) continue;
        var senderId = msg.sender.userId;
        if (senderId !== state.turn) {
            dispatcher.broadcastMessage(3, JSON.stringify({ type: "error", message: "Not your turn" }), [msg.sender], null, true);
            continue;
        }
        var data;
        try { data = JSON.parse(nk.binaryToString(msg.data)); } catch(e) { continue; }
        var pos = data.position;
        if (pos === undefined || pos < 0 || pos > 8 || state.board[pos] !== null) {
            dispatcher.broadcastMessage(3, JSON.stringify({ type: "error", message: "Invalid move" }), [msg.sender], null, true);
            continue;
        }
        state.board[pos] = state.marks[senderId];
        state.moveCount++;
        var winMark = checkWinner(state.board);
        if (winMark) {
            state.gameOver = true;
            if (winMark === "draw") {
                state.winner = "draw";
                for (var uid in state.players) {
                    if (state.players.hasOwnProperty(uid)) updateLeaderboard(nk, logger, uid, state.players[uid].username, "draw");
                }
            } else {
                var winnerId = null, loserId = null;
                for (var uid2 in state.marks) {
                    if (!state.marks.hasOwnProperty(uid2)) continue;
                    if (state.marks[uid2] === winMark) winnerId = uid2; else loserId = uid2;
                }
                state.winner = winnerId;
                if (winnerId && state.players[winnerId]) updateLeaderboard(nk, logger, winnerId, state.players[winnerId].username, "win");
                if (loserId && state.players[loserId]) updateLeaderboard(nk, logger, loserId, state.players[loserId].username, "loss");
            }
            dispatcher.broadcastMessage(1, JSON.stringify({
                type: "game_over", winner: state.winner, winMark: winMark,
                board: state.board, reason: winMark === "draw" ? "draw" : "win"
            }), null, null, true);
        } else {
            state.turn = getOtherPlayer(state, senderId);
            dispatcher.broadcastMessage(1, JSON.stringify({
                type: "move", board: state.board, turn: state.turn,
                lastMove: { position: pos, mark: state.marks[senderId], player: senderId }
            }), null, null, true);
        }
    }
    return { state: state };
};

var matchTerminate = function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
};

var matchSignal = function(ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state, data: "" };
};

var rpcGetLeaderboard = function(ctx, logger, nk, payload) {
    try {
        var records = nk.leaderboardRecordsList("global_leaderboard", [], 20, null, 0);
        var result = [];
        if (records.records) {
            for (var i = 0; i < records.records.length; i++) {
                var r = records.records[i];
                result.push({ userId: r.ownerId, username: r.username, score: r.score, rank: r.rank });
            }
        }
        return JSON.stringify({ records: result });
    } catch(e) {
        return JSON.stringify({ records: [] });
    }
};

// Use storage as a lobby: store open match ID, second player reads and joins it
var rpcFindMatch = function(ctx, logger, nk, payload) {
    var SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

    // Try to read existing open match from storage
    try {
        var reads = nk.storageRead([{ collection: "lobby", key: LOBBY_KEY, userId: SYSTEM_USER }]);
        if (reads && reads.length > 0) {
            var storedMatchId = reads[0].value.matchId;
            logger.info("Found lobby match: " + storedMatchId);
            // Delete the lobby entry so no third player joins
            try {
                nk.storageDelete([{ collection: "lobby", key: LOBBY_KEY, userId: SYSTEM_USER }]);
            } catch(e) {}
            return JSON.stringify({ matchId: storedMatchId });
        }
    } catch(e) {
        logger.info("No lobby match found: " + e);
    }

    // No open match — create one and store it
    var matchId = nk.matchCreate(MODULE_NAME, {});
    logger.info("Created new match: " + matchId);
    try {
        nk.storageWrite([{
            collection: "lobby",
            key: LOBBY_KEY,
            userId: SYSTEM_USER,
            value: { matchId: matchId },
            permissionRead: 2,
            permissionWrite: 0
        }]);
    } catch(e) {
        logger.error("Failed to write lobby: " + e);
    }
    return JSON.stringify({ matchId: matchId });
};

function InitModule(ctx, logger, nk, initializer) {
    try {
        nk.leaderboardCreate("global_leaderboard", false, "desc", "incr", "0 0 1 * *", {});
    } catch(e) { logger.info("Leaderboard already exists"); }

    initializer.registerMatch(MODULE_NAME, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal
    });
    initializer.registerRpc("find_match", rpcFindMatch);
    initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
    logger.info("Tic-Tac-Toe module loaded ✓");
}
