# Deuce

Deuce is an offline-first badminton session management PWA for organizers running club nights, queue rotations, and live courts.

It focuses on fair queueing, fast court operations, session-based history, and tactical visibility across mobile, tablet, and desktop.

## Features

- Session lifecycle (`Start session` / `End session`) with per-session history
- Fair queue ordering with:
  - Priority score: `(gamesPlayed * 100) - waitMinutes`
  - 30-minute anti-stagnation override
- Auto-fill matchmaker:
  - Picks top-priority players
  - Balances teams by non-linear team power
  - Shows fairness score and "Why Them?" badges
  - Guards against race conflicts before start
- Court operations:
  - Assign/remove players
  - Start/end match
  - Score input + duration tracking
- Dashboard:
  - Live stats, next-up queue, quick actions
  - Win streaks, Giant Killer, Session MVP
- Analytics:
  - Session-filtered leaderboard (win rate)
  - Match history with score and duration
- PWA support (enabled in production build)
- IndexedDB persistence via Dexie (works offline)

## Tech Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS 4
- Dexie + dexie-react-hooks
- Framer Motion
- `@ducanh2912/next-pwa`

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open `http://localhost:3000`.

> Note: PWA service worker is intentionally disabled in development to avoid cache interference.

### Production (PWA test mode)

```bash
npm run build
npm run start
```

Then verify installability and service worker in browser DevTools (`Application` tab).

## Project Structure

```text
src/
  app/
    (app)/
      page.tsx            # Dashboard
      queue/page.tsx      # The Roster
      war-room/page.tsx   # Courts
      analytics/page.tsx  # Analytics
  components/
  hooks/
  lib/
public/
  branding/
```

## Scripts

- `npm run dev` - start local dev server (webpack mode)
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run eslint
- `npm run clean` - remove `.next`

## Security Notes

- Dependency audit is clean for production install (`npm audit --omit=dev`).
- `.env*` files are gitignored by default.

## Documentation

- Implementation details: `IMPLEMENTATION.md`
