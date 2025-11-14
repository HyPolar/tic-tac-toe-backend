# Tic-Tac-Toe Clone (Sea Battle Parity)

This project replicates the Sea Battle app's structure and payment/game flow, with Tic-Tac-Toe gameplay and UI.

- Frontend: React app with Menu, Join, and History tabs and a 3x3 board
- Backend: Express + Socket.IO server, Sea Battle-like join/payment flow
- Bets & Payouts: Same mapping as Sea Battle (50→80, 300→500, 500→800, 1000→1700, 5000→8000, 10000→17000)
- Pattern: L-W-L-W per (username, bet)
- Demo mode on by default (no real Lightning calls)

## Quickstart (Windows)
- Backend
  1) Open terminal at `tic-tac-toe/backend`
  2) Copy env: `Copy-Item .env.example .env -Force`
  3) Install: `npm install`
  4) Run: `npm run dev` (or `npm start`)
- Frontend
  1) Open new terminal at `tic-tac-toe/frontend`
  2) Copy env: `Copy-Item .env.example .env -Force`
  3) Install: `npm install`
  4) Run: `npm start`

Open http://localhost:3000. Join → scan or click "I have paid (demo)" → wait for bot (or 2nd user) → play.

For more detailed steps, see `GETTING_STARTED.md`.
