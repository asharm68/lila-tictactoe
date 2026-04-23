// Nakama TypeScript Runtime - Tic-Tac-Toe Match Handler
// Server-authoritative: all game logic runs here

const MODULE_NAME = "tictactoe";
const TICK_RATE = 1; // 1 tick/sec (turn-based, no need for high rate)

// ─── Types ───────────────────────────────────────────────────────────────────

interface GameState {
  board: (string | null)[]; // 9 cells, null | "X" | "O"
  marks: { [userId: string]: string }; // userId → "X" | "O"
  turn: string; // userId whose turn it is
  winner: string | null; // userId of winner, or "draw", or null
  players: { [userId: string]: { username: string; presence: nkruntime.Presence } };
  moveCount: number;
  gameOver: boolean;
  presences: { [sessionId: string]: nkruntime.Presence };
}

interface MoveMessage {
  position: number; // 0–8
}

// ─── Win condition ────────────────────────────────────────────────────────────

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function checkWinner(board: (string | null)[]): string | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]!;
    }
  }
  if (board.every(cell => cell !== null)) return "draw";
  return null;
}

// ─── Match lifecycle ──────────────────────────────────────────────────────────

const matchInit: nkruntime.MatchInitFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: GameState; tickRate: number; label: string } => {
  const state: GameState = {
    board: Array(9).fill(null),
    marks: {},
    turn: "",
    winner: null,
    players: {},
    moveCount: 0,
    gameOver: false,
    presences: {},
  };
  logger.info("Match initialized");
  return { state, tickRate: TICK_RATE, label: "waiting" };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: GameState; accept: boolean; rejectMessage?: string } => {
  if (state.gameOver) {
    return { state, accept: false, rejectMessage: "Game already over" };
  }
  const playerCount = Object.keys(state.players).length;
  if (playerCount >= 2) {
    return { state, accept: false, rejectMessage: "Match is full" };
  }
  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  presences: nkruntime.Presence[]
): { state: GameState } | null => {
  for (const presence of presences) {
    state.presences[presence.sessionId] = presence;
    const mark = Object.keys(state.marks).length === 0 ? "X" : "O";
    state.marks[presence.userId] = mark;
    state.players[presence.userId] = { username: presence.username, presence };
    logger.info(`Player ${presence.username} joined as ${mark}`);
  }

  const playerCount = Object.keys(state.players).length;
  if (playerCount === 2) {
    // X goes first
    const xPlayer = Object.entries(state.marks).find(([, m]) => m === "X")![0];
    state.turn = xPlayer;
    dispatcher.matchLabel("playing");
    // Broadcast initial game state
    dispatcher.broadcastMessage(1, JSON.stringify({
      type: "game_start",
      board: state.board,
      marks: state.marks,
      turn: state.turn,
      players: Object.fromEntries(
        Object.entries(state.players).map(([id, p]) => [id, p.username])
      ),
    }), null, null, true);
    logger.info("Game started!");
  } else {
    dispatcher.matchLabel("waiting");
    dispatcher.broadcastMessage(1, JSON.stringify({
      type: "waiting",
      message: "Waiting for opponent...",
    }), null, null, true);
  }

  return { state };
};

const matchLeave: nkruntime.MatchLeaveFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  presences: nkruntime.Presence[]
): { state: GameState } | null => {
  for (const presence of presences) {
    delete state.presences[presence.sessionId];
    logger.info(`Player ${presence.username} left`);

    if (!state.gameOver) {
      state.gameOver = true;
      state.winner = "disconnect";
      // Find remaining player
      const remainingId = Object.keys(state.players).find(id => id !== presence.userId);
      dispatcher.broadcastMessage(1, JSON.stringify({
        type: "game_over",
        winner: remainingId ?? null,
        reason: "opponent_disconnected",
        board: state.board,
      }), null, null, true);

      // Update leaderboard - winner gets points
      if (remainingId) {
        updateLeaderboard(nk, logger, remainingId, state.players[remainingId].username, "win");
        updateLeaderboard(nk, logger, presence.userId, presence.username, "loss");
      }
    }
    delete state.players[presence.userId];
  }
  return { state };
};

const matchLoop: nkruntime.MatchLoopFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  messages: nkruntime.MatchMessage[]
): { state: GameState } | null => {
  // End match if no players
  if (Object.keys(state.presences).length === 0) {
    logger.info("No presences, ending match");
    return null;
  }

  // Process move messages (opCode 2)
  for (const msg of messages) {
    if (msg.opCode !== 2) continue;
    if (state.gameOver) continue;

    const senderId = msg.sender.userId;

    // Validate it's this player's turn
    if (senderId !== state.turn) {
      dispatcher.broadcastMessage(3, JSON.stringify({
        type: "error",
        message: "Not your turn",
      }), [msg.sender], null, true);
      continue;
    }

    let data: MoveMessage;
    try {
      data = JSON.parse(nk.binaryToString(msg.data));
    } catch (e) {
      logger.error("Invalid message data");
      continue;
    }

    const pos = data.position;
    if (pos < 0 || pos > 8 || state.board[pos] !== null) {
      dispatcher.broadcastMessage(3, JSON.stringify({
        type: "error",
        message: "Invalid move",
      }), [msg.sender], null, true);
      continue;
    }

    // Apply move
    const mark = state.marks[senderId];
    state.board[pos] = mark;
    state.moveCount++;

    // Check winner
    const winMark = checkWinner(state.board);
    if (winMark) {
      state.gameOver = true;
      let winnerId: string | null = null;
      let loserId: string | null = null;

      if (winMark === "draw") {
        state.winner = "draw";
      } else {
        winnerId = Object.entries(state.marks).find(([, m]) => m === winMark)![0];
        loserId = Object.keys(state.players).find(id => id !== winnerId) ?? null;
        state.winner = winnerId;
      }

      dispatcher.broadcastMessage(1, JSON.stringify({
        type: "game_over",
        winner: state.winner,
        winMark,
        board: state.board,
        reason: winMark === "draw" ? "draw" : "win",
      }), null, null, true);

      // Update leaderboard
      if (winnerId) {
        updateLeaderboard(nk, logger, winnerId, state.players[winnerId].username, "win");
        if (loserId) updateLeaderboard(nk, logger, loserId, state.players[loserId].username, "loss");
      } else {
        // draw
        for (const [uid, p] of Object.entries(state.players)) {
          updateLeaderboard(nk, logger, uid, p.username, "draw");
        }
      }
    } else {
      // Switch turn
      state.turn = Object.keys(state.players).find(id => id !== senderId)!;
      dispatcher.broadcastMessage(1, JSON.stringify({
        type: "move",
        board: state.board,
        turn: state.turn,
        lastMove: { position: pos, mark, player: senderId },
      }), null, null, true);
    }
  }

  return { state };
};

const matchTerminate: nkruntime.MatchTerminateFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  graceSeconds: number
): { state: GameState } | null => {
  logger.info("Match terminated");
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: GameState,
  data: string
): { state: GameState; data?: string } => {
  return { state, data: "" };
};

// ─── Leaderboard helpers ──────────────────────────────────────────────────────

function updateLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  username: string,
  result: "win" | "loss" | "draw"
) {
  try {
    const scoreMap = { win: 3, draw: 1, loss: 0 };
    nk.leaderboardRecordWrite(
      "global_leaderboard",
      userId,
      username,
      scoreMap[result],
      0,
      { lastResult: result },
      ["win", "draw", "loss"].map(() => 0) // subscore unused
    );
  } catch (e) {
    logger.error("Leaderboard update failed: " + e);
  }
}

// ─── RPC: Get leaderboard ─────────────────────────────────────────────────────

const rpcGetLeaderboard: nkruntime.RpcFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string => {
  try {
    const records = nk.leaderboardRecordsList("global_leaderboard", [], 20, null, 0);
    return JSON.stringify({
      records: records.records?.map(r => ({
        userId: r.ownerId,
        username: r.username,
        score: r.score,
        rank: r.rank,
        metadata: r.metadata,
      })) ?? [],
    });
  } catch (e) {
    logger.error("Get leaderboard failed: " + e);
    return JSON.stringify({ records: [] });
  }
};

// ─── RPC: Create/find match ───────────────────────────────────────────────────

const rpcFindMatch: nkruntime.RpcFunction = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string => {
  // Look for a waiting match first
  const matches = nk.matchList(10, true, "waiting", null, null, null);
  if (matches.length > 0) {
    return JSON.stringify({ matchId: matches[0].matchId });
  }
  // Otherwise create new match
  const matchId = nk.matchCreate(MODULE_NAME, {});
  return JSON.stringify({ matchId });
};

// ─── Register everything ──────────────────────────────────────────────────────

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  // Create leaderboard (idempotent)
  try {
    nk.leaderboardCreate(
      "global_leaderboard",
      false,        // authoritative
      "desc",       // sort
      "incr",       // operator
      "0 0 1 * *",  // reset monthly
      {}
    );
  } catch (e) {
    logger.info("Leaderboard already exists or creation skipped");
  }

  initializer.registerMatch(MODULE_NAME, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });

  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);

  logger.info("Tic-Tac-Toe module loaded ✓");
}
