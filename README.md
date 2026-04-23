# LILA × Tic-Tac-Toe — Multiplayer Backend Assignment

A production-ready, real-time multiplayer Tic-Tac-Toe game built with **Nakama** (server-authoritative backend) and **React** (frontend), deployed via Docker Compose locally and Vercel for the frontend.

---

## Live Demo

| Resource | URL |
|---|---|
| Game (Frontend) | `https://lila-tictactoe-kawqywc88-asharm68s-projects.vercel.app` |
| Nakama Console | `http://localhost:7351` (local) |
| Nakama HTTP API | `http://localhost:7350` (local) |

---

## Architecture & Design Decisions

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (React)                     │
│  LoginScreen → WaitingScreen → GameBoard → GameOver     │
│         nakama-js SDK (WebSocket + HTTP RPC)            │
└───────────────────────┬─────────────────────────────────┘
                        │  WebSocket (real-time)
                        │  HTTP RPC (matchmaking, leaderboard)
┌───────────────────────▼─────────────────────────────────┐
│                  NAKAMA SERVER (Go)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │        JavaScript Runtime Module (index.js)       │   │
│  │  • match_handler.ts  — all game logic (source)   │   │
│  │  • RPC: find_match   — storage-based matchmaking │   │
│  │  • RPC: get_leaderboard — rankings               │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Built-in Nakama Features                  │   │
│  │  • Device authentication (no account needed)     │   │
│  │  • Authoritative match handler (tick-based)      │   │
│  │  • Leaderboard with monthly reset                │   │
│  │  • Storage API for lobby/matchmaking             │   │
│  │  • WebSocket real-time message broadcast         │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              CockroachDB (Postgres-compatible)           │
│  Sessions · Accounts · Leaderboard · Match metadata     │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Server-Authoritative Architecture**
All game state lives on the Nakama server. The client only sends *intent* (a position index 0–8). The server validates the move, updates state, checks win conditions, and broadcasts the new state to both players. Clients cannot cheat by modifying local state.

**OpCode Protocol**
| OpCode | Direction | Purpose |
|--------|-----------|---------|
| 1 | Server → Clients | State updates (game_start, move, game_over, waiting) |
| 2 | Client → Server | Player move `{ position: 0-8 }` |
| 3 | Server → Client | Error messages (not your turn, invalid move) |

**Matchmaking Flow**
1. Client calls `find_match` RPC
2. Server checks Nakama **storage** for an open lobby entry
3. If found → delete the lobby entry → return that match ID to second player
4. If not found → create new match → store match ID in storage → return to first player
5. When 2 players join → server broadcasts `game_start`

**Why Storage-Based Matchmaking?**
Nakama's `matchList` API with size filters is unreliable for finished matches in this version. Using the storage API as a lobby ensures only active waiting matches are returned, and the atomic delete prevents race conditions.

**Concurrent Game Support**
Each match runs as an isolated Nakama authoritative match with its own goroutine and state. Hundreds of simultaneous games are supported natively — Nakama handles the scheduling. Game room isolation is guaranteed because state is scoped to the match instance.

**Leaderboard**
- Scoring: Win = 3pts, Draw = 1pt, Loss = 0pts
- Global leaderboard resets monthly (cron: `0 0 1 * *`)
- Updated server-side on game over or disconnect — client cannot manipulate scores

**Authentication**
Device-based auth (no sign-up required). A UUID is generated and persisted in `localStorage`. On reconnect, the same identity is restored automatically.

**JavaScript Runtime Note**
Nakama 3.20's goja JS engine does not support ES6+ shorthand property syntax. The server module (`index.js`) is written in ES5-compatible JavaScript. The TypeScript source (`match_handler.ts`) is kept for reference and documentation purposes.

---

## Project Structure

```
lila-tictactoe/
├── .gitignore
├── docker-compose.yml              # Nakama + CockroachDB stack
├── README.md
├── nakama-server/
│   ├── build/
│   │   └── index.js                # Compiled ES5 module (mounted into Nakama)
│   ├── src/
│   │   ├── match_handler.ts        # TypeScript source (game logic, RPCs, leaderboard)
│   │   └── nkruntime.d.ts          # Nakama runtime type declarations
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
└── frontend/
    ├── public/
    │   └── favicon.svg
    ├── src/
    │   ├── components/
    │   │   ├── GameBoard.tsx        # Game board UI and cell interactions
    │   │   ├── GameOverScreen.tsx   # Result screen with leaderboard
    │   │   ├── LoginScreen.tsx      # Username entry screen
    │   │   └── WaitingScreen.tsx    # Matchmaking waiting screen
    │   ├── hooks/
    │   │   └── useNakama.ts         # All Nakama SDK logic (connection, matchmaking, state)
    │   ├── App.css                  # Global styles (cyberpunk theme)
    │   ├── App.tsx                  # Root component, phase routing
    │   ├── main.tsx                 # React entry point
    │   └── vite-env.d.ts            # Vite environment type declarations
    ├── .env.example                 # Environment variables template
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vercel.json                  # Vercel deployment config
    └── vite.config.ts
```

---

## Local Setup & Installation

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 18+

### Step 1 — Start Nakama + CockroachDB

```bash
# From project root
docker compose up -d

# Wait ~30 seconds, then verify:
docker compose logs nakama --tail=5
# Should show: "Startup done" and "Tic-Tac-Toe module loaded ✓"
```

Nakama will be available at:
- HTTP API: http://localhost:7350
- Console UI: http://localhost:7351 (admin / admin_password)
- gRPC: localhost:7349

> Note: `nakama-server/build/index.js` is pre-compiled and committed to the repo. No separate build step is needed.

### Step 2 — Start the Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

### Step 3 — Test Multiplayer

1. Open `http://localhost:3000` in a normal Chrome window
2. Open `http://localhost:3000` in an Incognito window (Cmd+Shift+N)
3. Enter different names in each → click **FIND MATCH**
4. Both players are auto-matched and the game starts

> Two separate browser contexts are needed because device auth uses `localStorage` — both tabs in the same window share the same identity.

---

## Deployment

### Frontend — Vercel (Free)

```bash
cd frontend
# Set production env vars pointing to your Nakama server
cp .env.example .env.production
# Edit VITE_NAKAMA_HOST, VITE_NAKAMA_PORT, VITE_NAKAMA_SSL

npm run build
npx vercel --prod
```

Or connect GitHub repo to Vercel dashboard with Root Directory set to `frontend`.

### Backend — Docker Compose (Local or Cloud)

The Nakama server runs via Docker Compose. For cloud deployment:

**Option A: Any VPS (DigitalOcean, AWS EC2, etc.)**
```bash
# Copy project to server
scp -r . user@your-server:~/lila-tictactoe
ssh user@your-server
cd lila-tictactoe && docker compose up -d
```

**Option B: Local + ngrok (for demo/testing)**
```bash
# After docker compose up -d
ngrok http 7350
# Use the ngrok URL as VITE_NAKAMA_HOST in frontend .env
```

---

## API & Server Configuration

### Nakama RPC Endpoints

**POST /v2/rpc/find_match**
```json
// Request: {}
// Response:
{ "matchId": "uuid-of-match.nakama1" }
```

**POST /v2/rpc/get_leaderboard**
```json
// Request: {}
// Response:
{
  "records": [
    { "userId": "...", "username": "Player1", "score": 9, "rank": 1 }
  ]
}
```

### WebSocket Message Format

**Server → Client OpCode 1 (game events):**
```json
{ "type": "game_start", "board": [null,...], "marks": {"userId": "X"}, "turn": "userId", "players": {"userId": "username"} }
{ "type": "move", "board": [...], "turn": "userId", "lastMove": { "position": 4, "mark": "X", "player": "userId" } }
{ "type": "game_over", "winner": "userId|draw", "board": [...], "reason": "win|draw|opponent_disconnected" }
{ "type": "waiting", "message": "Waiting for opponent..." }
```

**Client → Server OpCode 2 (player move):**
```json
{ "position": 4 }
```

### Leaderboard Configuration
- ID: `global_leaderboard`
- Sort: descending by score
- Operator: increment (scores accumulate over time)
- Reset: monthly (1st of each month at midnight)

---

## How to Test Multiplayer

### Basic Game Test
1. Open `http://localhost:3000` in Chrome (normal window)
2. Open `http://localhost:3000` in Chrome Incognito (Cmd+Shift+N)
3. Enter different names → click **FIND MATCH** in both
4. Game board appears in both windows simultaneously
5. Take turns clicking cells — only the active player's clicks register
6. Try clicking out of turn → server rejects it with an error toast
7. After game ends → leaderboard updates with scores

### Verify Server-Authoritative Logic
- Open DevTools → Network → WS tab
- All game state arrives FROM the server
- Client only sends `{ "position": N }` — zero game logic on client side

### Test Disconnect Handling
- During a game, close one browser window
- The remaining player sees "Opponent Left" and wins automatically
- Leaderboard credits the win correctly

### Test Concurrent Sessions
- Open 4 browser contexts (2 normal + 2 incognito won't work — use different browsers)
- Each pair gets isolated game sessions with independent state

### Test Play Again
- After game over, click **Play Again** in both windows
- Both reconnect and find each other in a new match automatically
- No need to re-enter username

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game Backend | Nakama 3.20 (Go) |
| Server Logic | JavaScript ES5 (Nakama JS Runtime / goja) |
| Server Source | TypeScript (compiled to ES5) |
| Database | CockroachDB (Postgres-compatible) |
| Frontend | React 18 + Vite |
| Client SDK | @heroiclabs/nakama-js 2.8.0 |
| Styling | Pure CSS (no UI library) |
| Local Dev | Docker Compose v2 |
| Frontend Deploy | Vercel (free) |
| Backend Deploy | Docker Compose (local / any VPS) |

---

## Bonus Features Implemented

- ✅ **Concurrent Game Support** — Each game runs as an isolated Nakama authoritative match with its own goroutine and state. The storage-based lobby ensures players join separate matches. Multiple simultaneous games run with zero shared state.
- ✅ **Leaderboard System** — Global ranking by score (Win=3, Draw=1, Loss=0) with monthly reset. Updated server-side on every game conclusion including disconnects. Displayed on game over screen with player highlighted.

---

*Built for LILA Engineering Backend Assignment*
