# Getting Started

This Tic-Tac-Toe app mirrors your Sea Battle flow: join → pay invoice → play vs bot/human → automatic L/W pattern → payout event.

- Backend default: demo mode (no real payments). Use the "I have paid (demo)" button.
- Frontend default bet: 50 SATS. Default payout shown: 80 SATS.

## Prereqs
- Node 16+ installed

## Backend (demo mode)
1. Copy env
   - Windows PowerShell
     - Copy-Item .env.example .env
2. Install
   - npm install
3. Run
   - npm run dev (or npm start)
4. Server runs at http://localhost:4000

## Frontend
1. Copy env
   - Copy-Item .env.example .env
2. Edit .env if needed
   - REACT_APP_BACKEND_URL=http://localhost:4000
3. Install
   - npm install
4. Run
   - npm start
5. Open http://localhost:3000

## Using it
1. Go to Join tab, enter your Lightning username (optional), choose a bet (50 default)
2. Click Join & Pay
3. In demo mode, click "I have paid (demo)" after QR appears
4. You will be matched with a bot shortly if no other player is found
5. Play on the 3x3 grid; history tab records win/loss locally

## Real payments (optional)
- Backend env:
  - DEMO_MODE=false
  - SPEED_WALLET_SECRET_KEY=...
  - SPEED_WALLET_WEBHOOK_SECRET=...
  - ALLOWED_ORIGIN=http://localhost:3000
- Expose webhook to the internet (e.g., ngrok) and set provider to POST to /webhook
- The server expects "invoice.paid"/"payment.paid"/"payment.confirmed" style events with an invoice id

## Notes
- Pattern logic: per (username, bet) pair, the app enforces Lose on 1st, Win on 2nd, Lose on 3rd, Win on 4th, etc.
- Payout mapping mirrors your Sea Battle values.
- Sea Battle project is untouched; this folder is self-contained.
