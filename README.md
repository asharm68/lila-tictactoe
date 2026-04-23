# LILA × Tic-Tac-Toe — Multiplayer Backend Assignment

A production-ready, real-time multiplayer Tic-Tac-Toe game built with **Nakama** (server-authoritative backend) and **React** (frontend), deployed via Docker Compose locally and Vercel + Railway/Fly.io for production.

---

## Live Demo

| Resource | URL |
|---|---|
| Game (Frontend) | `https://lila-tictactoe.vercel.app` *(after deploy)* |
| Nakama Console | `http://<your-server>:7351` |
| Nakama HTTP API | `http://<your-server>:7350` |

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
│  │        TypeScript Runtime Module                  │   │
│  │  • match_handler.ts  — all game logic            │   │
│  │  • RPC: find_match   — matchmaking               │   │
│  │  • RPC: get_leaderboard — rankings               │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Built-in Nakama Features                  │   │
│  │  • Device authentication (no account needed)     │   │
│  │  • Authoritative match handler (tick-based)      │   │
│  │  • Leaderboard with monthly reset                │   │
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
2. Server queries for existing matches with label `"waiting"`
3. If found → join that match; else → create new match
4. When 2 players join → server broadcasts `game_start`, sets label to `"playing"`

**Concurrent Game Support**
Each match runs as an isolated Nakama authoritative match with its own goroutine and state. Hundreds of simultaneous games are supported natively — Nakama handles the scheduling. Game room isolation is guaranteed because state is scoped to the match instance.

**Leaderboard**
- Scoring: Win = 3pts, Draw = 1pt, Loss = 0pts
- Global leaderboard resets monthly (cron: `0 0 1 * *`)
- Updated server-side on game over or disconnect — client cannot manipulate scores

**Authentication**
Device-based auth (no sign-up required). A UUID is generated and persisted in `localStorage`. On reconnect, the same identity is restored.

---

## Project Structure

```
lila-tictactoe/
├── docker-compose.yml              # Nakama + CockroachDB stack
├── nakama-server/
│   ├── src/
│   │   ├── match_handler.ts        # All game + leaderboard + RPC logic
│   │   └── nkruntime.d.ts          # Nakama runtime type declarations
│   ├── build/
│   │   └── match_handler.js        # Compiled output (mounted into Nakama)
│   ├── tsconfig.json
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.tsx                  # Root component, phase routing
    │   ├── App.css                  # Global styles (cyberpunk theme)
    │   ├── main.tsx
    │   ├── hooks/
    │   │   └── useNakama.ts         # All Nakama SDK logic
    │   └── components/
    │       ├── LoginScreen.tsx
    │       ├── WaitingScreen.tsx
    │       ├── GameBoard.tsx
    │       └── GameOverScreen.tsx
    ├── .env.example
    ├── vite.config.ts
    └── package.json
```

---

## Local Setup & Installation

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker + Docker Compose)
- Node.js 18+

### Step 1 — Build the Nakama TypeScript module

```bash
cd nakama-server
npm install
npx tsc
# Output: build/match_handler.js
```

### Step 2 — Start Nakama + CockroachDB

```bash
# From project root
docker-compose up -d

# Wait ~30 seconds for CockroachDB to initialize, then check:
docker-compose logs nakama | grep "Startup"
```

Nakama will be available at:
- HTTP API: http://localhost:7350
- Console UI: http://localhost:7351 (admin / admin_password)
- gRPC: localhost:7349

### Step 3 — Start the Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local — defaults work for local Docker setup

npm install
npm run dev
# → http://localhost:3000
```

### Step 4 — Test Multiplayer

Open two browser tabs at `http://localhost:3000`. Enter different usernames in each tab. Both will be matchmade into the same game automatically.

---

## Deployment

### Free Deployment — Zero Cost Setup

#### Option A: Railway (Nakama) + Vercel (Frontend)

**Deploy Nakama on Railway:**

1. Create account at [railway.app](https://railway.app) (free tier, no credit card)
2. New Project → Deploy from Docker Compose
3. Upload `docker-compose.yml` or use Railway's template
4. Set environment variables:
   ```
   NAKAMA_CONSOLE_USERNAME=admin
   NAKAMA_CONSOLE_PASSWORD=your_secure_password
   ```
5. Railway will give you a public URL like `nakama-production.up.railway.app`
6. Mount the `nakama-server/build/` folder contents as the modules volume

**Deploy Frontend on Vercel:**

```bash
cd frontend

# Set production env vars
cp .env.example .env.production
# Edit .env.production:
# VITE_NAKAMA_HOST=nakama-production.up.railway.app
# VITE_NAKAMA_PORT=443
# VITE_NAKAMA_SSL=true

npm run build

# Install Vercel CLI
npm i -g vercel
vercel --prod
```

#### Option B: Fly.io (Nakama) — also free tier

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# From project root
fly launch --name lila-nakama
fly deploy
```

#### Option C: Local + ngrok (for sharing without deploying)

```bash
# After docker-compose up
ngrok http 7350
# Use the ngrok URL as VITE_NAKAMA_HOST
```

---

## API & Server Configuration

### Nakama RPC Endpoints

**POST /v2/rpc/find_match**
```json
// Request: {}
// Response:
{ "matchId": "uuid-of-match" }
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

Connect to: `ws://localhost:7350/ws?token=<session_token>`

**Server → Client OpCode 1 (game events):**
```json
// game_start
{ "type": "game_start", "board": [null,...], "marks": {"userId": "X"}, "turn": "userId", "players": {"userId": "username"} }

// move
{ "type": "move", "board": [...], "turn": "userId", "lastMove": { "position": 4, "mark": "X", "player": "userId" } }

// game_over
{ "type": "game_over", "winner": "userId|draw|disconnect", "board": [...], "reason": "win|draw|opponent_disconnected" }
```

**Client → Server OpCode 2 (player move):**
```json
{ "position": 4 }
```

### Leaderboard Configuration
- ID: `global_leaderboard`
- Sort: descending by score
- Operator: increment (scores accumulate)
- Reset: monthly (1st of each month at midnight)

---

## How to Test Multiplayer

### Manual Test
1. Open `http://localhost:3000` in two separate browser windows (or one normal + one incognito)
2. Enter a username in each and click **FIND MATCH**
3. Both players will be auto-matched within seconds
4. Take turns clicking cells — only the current player's clicks are accepted
5. Try clicking out of turn — the server rejects it (error toast appears)
6. After game ends, the leaderboard updates automatically

### Verify Server-Authoritative Logic
- Open browser DevTools → Network → WS
- Observe all game state comes FROM the server, not computed client-side
- The client only sends `{ "position": N }` — all validation happens server-side

### Test Disconnect Handling
- Mid-game, close one browser tab
- The remaining player sees "Opponent Left" and is credited a win
- Leaderboard updates correctly

### Test Concurrent Sessions
- Open 4+ tabs and create 2+ simultaneous games
- Each game is fully isolated with independent state

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game Backend | Nakama 3.20 (Go) |
| Server Logic | TypeScript (Nakama TS Runtime) |
| Database | CockroachDB (Postgres-compatible) |
| Frontend | React 18 + Vite |
| Client SDK | @heroiclabs/nakama-js |
| Styling | Pure CSS (no UI library) |
| Local Dev | Docker Compose |
| Frontend Deploy | Vercel (free) |
| Backend Deploy | Railway / Fly.io (free tier) |

---

## Bonus Features Implemented

- ✅ **Concurrent Game Support** — Nakama's authoritative match system natively isolates each game session. Multiple games run simultaneously with zero shared state.
- ✅ **Leaderboard System** — Global ranking by score (Win=3, Draw=1, Loss=0) with monthly reset. Updated server-side on every game conclusion, including disconnects.

---

*Built for LILA Engineering Backend Assignment*
