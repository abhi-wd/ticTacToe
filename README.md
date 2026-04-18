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

---

## 🚀 Deployment Guide (DigitalOcean)

### Phase 1: Deploying Nakama to DigitalOcean (Droplet)
To host Nakama yourself, spinning up a basic Linux Droplet is the most flexible approach.

1. **Create a Droplet**
   - Go to DigitalOcean -> **Create Droplet**.
   - Choose **Docker on Ubuntu** from the Marketplace.
   - Choose the `$12/mo` or `$24/mo` Premium instance (Nakama uses around 1-2GB RAM).
   - Select your region, setup SSH keys, and create.

2. **Configure the Server**
   - SSH into your Droplet: `ssh root@YOUR_DROPLET_IP`
   - Clone your repository:
     ```bash
     git clone https://github.com/YOUR_USERNAME/TicTacToe.git /opt/tictactoe
     cd /opt/tictactoe/backend

     git clone https://github.com/abhi-wd/ticTacToe.git /opt/tictactoe
     ```

3. **Install Dependencies & Build**
   - Install NodeJS (via nvm):
     ```bash
     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
     source ~/.bashrc
     nvm install 20
     npm install
     npm run build
     ```
4. **Boot the Production Docker Container**
   - Head back to the project root and launch.
     ```bash
     cd /opt/tictactoe
     docker-compose -f docker-compose.yml up -d
     ```
5. **Firewall (UFW) Configuration**
   Ubuntu comes with UFW (Uncomplicated Firewall). You need to open Nakama's ports:
   ```bash
   ufw allow 22/tcp    # SSH
   ufw allow 7350/tcp  # Nakama API & WebSockets
   ufw allow 7351/tcp  # Nakama Console
   ufw enable          # Activate the firewall
   ```

6. **Connecting a Custom Domain (DNS)**
   If you bought a domain (e.g., from Namecheap or GoDaddy), log into your registrar and create an **A Record**:
   - **Type**: `A`
   - **Host/Name**: `@` (or `api` for a subdomain like `api.mygame.com`)
   - **Value/Target**: `YOUR_DROPLET_IP`
   - **TTL**: Lowest possible (e.g., 5 mins)

   *Note: For production environments, it is highly recommended to set up a reverse proxy like **Nginx** or **Caddy** to provide SSL (`https://` and `wss://`) over port 443, routing traffic internally to Nakama on 7350.*

### Phase 2: Deploying the Frontend (Vercel / Netlify)

1. **Update SDK Configuration**
   - Open `frontend/src/nakama.ts`.
   - Update your host string to your Digital Ocean Dropet IP or Domain.
   ```typescript
   export const client = new Client("defaultkey", "YOUR_DROPLET_IP_OR_DOMAIN", "7350", false);
   // Change UseSSL to `true` if you configured NGINX/Caddy for HTTPS
   ```

2. **Deploy to Vercel/Netlify**
   - Connect your GitHub repo to Vercel.
   - Set the root directory to `frontend`.
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Click Deploy.

Your frontend will now instantly interface with your authoritative Nakama instance hosted inside DigitalOcean! Enjoy!
