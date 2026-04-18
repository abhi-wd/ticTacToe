# ✕ ○ Tic-Tac-Toe — Server-Authoritative Multiplayer (LILA Engineering Test)

A production-ready, real-time multiplayer Tic-Tac-Toe game engineered as a technical showcase. It utilizes a **Server-Authoritative Match architecture** entirely built within the **Nakama Game Server** in TypeScript. 

The primary goal of this architecture is preventing client-side spoofing, guaranteeing consistency, and demonstrating mastery over distributed game state synchronization.

---

## 🎯 Features

This repository completes **100% of the core requirements** and implements all **optional requirements**, plus two complex bonuses demonstrating deeper Nakama fundamental mechanics:

- ✅ **Server-Authoritative State**: Validation, win checks, and timers are purely server-controlled. The React client acts as a "dumb view".
- ✅ **Nakama Matchmaker**: Auto-queuing isolated into modes (Classic vs Timed). 
- ✅ **Leaderboard & Profiling**: Tracks Wins, Losses, and Win Streaks via Nakama Storage APIs with Non-Incremental Overrides.
- ✅ **Timer-Based "Blitz" Mode**: 30-second server-side enforced match loops with auto-forfeiture disconnect/latency thresholds. 
- 🚀 **Bonus 1:** `Play with Friend` Private Rooms — Instantiates ad-hoc server matches and pins a custom `5-Digit Room Code` into Nakama NoSQL parameters for immediate direct joining via custom RPCs.
- 🚀 **Bonus 2:** `In-Game Realtime Emotes` — Emotes sent via custom `OpCode.EMOTE` that dynamically multiplexes across the WebSocket overlaying the authoritative match-state perfectly and cleanly rendering pop-up animations over players.

## 🏗️ Architecture Stack

- **Backend**: [Nakama Server](https://heroiclabs.com/nakama/) (Goja JavaScript runtime). 
- **Frontend**: **React.js + Vite** with TailwindCSS and Zustand for robust phase-state locking.
- **Client SDK**: `@heroiclabs/nakama-js`
- **Data Engine**: PostgreSQL / Nakama APIs

---

## 💻 Local Development

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) v20+

### 1. Launch Nakama Backend
The entire Nakama service, database, and backend module build process is bundled in docker compose.
```bash
# Clean install, compile TS code, and spin up isolated Docker network 
cd backend
npm install
npm run build
cd ..

# Startup Nakama Server and CockroachDB/PostgreSQL locally
docker compose up -d
```
> The Nakama console is running at: http://localhost:7351 (`admin` / `password`)

### 2. Launch Vite Frontend
```bash
cd frontend
npm install
npm run dev
```
> The game is running at: http://localhost:5173
