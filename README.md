# Deuce

**Live:** [deuce-psi.vercel.app](https://deuce-psi.vercel.app)

Deuce is an offline-first web app for running badminton club nights. One organiser checks players in, keeps a fair rotation going across several courts, records scores, and sees who's winning — all on a phone, tablet or laptop, with no account and no server.

Everything is stored in the browser on the device you use (IndexedDB). Nothing is sent anywhere, and the app keeps working without a connection once it has loaded.

## How a session works

1. **Roster** — add everyone who turned up, with gender and skill level. Set each player to **Playing**, **Break** or **Left** as the night goes on.
2. **Dashboard** — start a session. You can keep last week's roster or start fresh.
3. **Courts** — fill each court by picking players or tapping **Auto-fill**, start the match, then enter the score when it ends.
4. **Stats** — leaderboard and match history for the current session, any past session, or all sessions.

## Features

### Roster
- Quick add with validation: names are required, up to 24 characters, and must be unique (case-insensitive)
- Rapid adds are queued in order, so tapping Add quickly never drops a player
- Sorted A–Z, with Edit (name, gender, level) and Remove (with confirmation; blocked while the player is on court)
- Two skill modes: **Recreational** (Beginner / Intermediate / Advanced) and **Competitive** (A–K)
- Court count setting and a one-time **Shuffle first round** (needs 10+ available players)

### Fair queue
Players waiting to play are ordered by:
1. Anyone who has waited **30+ minutes** jumps to the front
2. Priority score `gamesPlayed × 100 − minutesWaited` (fewer games first, then longest wait)
3. Ties broken by games played, wait start time, skill level, then name

Players on **Break** or marked **Left**, and anyone already on a court, are left out of the queue.

### Courts and Auto-fill
- Build Team A vs Team B per court; the same player can't be placed twice
- **Auto-fill** takes the front of the queue and fills only the open spots, keeping anyone you placed by hand
- On an empty court it picks the most balanced split using a non-linear skill "power" curve, and avoids pairing a player with their partner from their last game when the teams stay balanced
- The suggestion shows a fairness percentage and badges (**Fresh**, **Longest Wait**) before you confirm
- **Start match** unlocks once all four spots are filled; Remove is hidden while a match is live
- **End match** asks for both scores (0–99), shows each team's players, and asks before saving a level score as a draw
- The screen is kept awake during a session where the browser supports it (Wake Lock API)

### Dashboard
- Roster, active, waiting and live-court counts
- Next four players up
- Top three on the leaderboard
- Live highlights: win streaks (3+), **Giant Killer** (biggest upset by skill) and **Session MVP** (best point spread)

### Stats
- Leaderboard by win rate, with medals only for players who have won
- Match history with teams, score, winner and duration
- Filter by session or view all sessions
- **Reset memory** erases all local data on this device (with confirmation)

### Layouts and install
- Phones, tablets and laptops: bottom tab bar and stacked courts, with a slide-up queue sheet
- Wide desktop (1536px+): collapsible sidebar, one court at a time with tabs, and a live side panel
- Installable as an app (PWA) on Android, iOS (Add to Home Screen) and desktop browsers

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Storage | Dexie (IndexedDB) with `dexie-react-hooks` for live queries |
| Motion | Framer Motion |
| PWA | `@ducanh2912/next-pwa` (Workbox service worker, production builds only) |
| Fonts | Sora and IBM Plex Sans via `next/font` (self-hosted at build time) |
| Hosting | Vercel |

## Getting started

### Prerequisites
- Node.js **20.9 or newer** (required by Next.js 16)
- npm 10+

### Install and run

```bash
npm install
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The service worker is disabled in development so cached files don't get in the way. To test the installable app and offline mode, run a production build:

```bash
npm run build
```

```bash
npm run start
```

Then check **Application → Service workers** and **Manifest** in your browser's DevTools.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server (webpack mode) |
| `npm run build` | Production build (webpack mode, so the PWA plugin runs) |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check types with TypeScript |
| `npm test` | Run the automated tests once |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run test:coverage` | Run tests with a coverage report |
| `npm run icons` | Regenerate the favicon and app icons from `public/branding/deuce-icon-logo.png` |
| `npm run clean` | Delete the `.next` folder |

## Testing

Tests use [Vitest](https://vitest.dev). They run in Node, with jsdom and an in-memory IndexedDB ([fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB)) where the app's data layer needs a browser.

- `src/lib/*.test.ts` — queue ordering, the 30-minute override, team balancing, repeat-partner avoidance and auto-fill selection.
- `src/hooks/use-deuce-session.test.ts` — the real data layer end to end: adding and validating players, statuses and the queue, courts and matches, scoring, court count changes, sessions, stats and reset.
- `src/hooks/use-local-storage-flag.test.ts` — remembered UI settings such as the collapsed sidebar.

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck, tests and a production build on Node 20.19 and 22 for every pull request and every push to `main`.

## Project structure

```text
src/
  app/
    (app)/
      page.tsx              # Dashboard
      queue/page.tsx        # Roster
      war-room/page.tsx     # Courts
      analytics/page.tsx    # Stats
    layout.tsx              # Fonts, metadata, icons
    manifest.ts             # PWA manifest
  components/
    views/                  # One view component per page
    badminton-court.tsx     # Court diagram, slots and match buttons
    queue/                  # Waiting list and queue sheet
    navigation/             # Tab bar, sidebar, app shell
    session/                # Start-session modal, live side panel
  hooks/
    use-deuce-session.ts    # All reads and writes: players, courts, sessions, matches
  lib/
    db.ts                   # Dexie schema (database: deuce-db)
    queue.ts                # Queue ordering, team balancing, auto-fill selection
    skill.ts                # Skill values and power curve
    types.ts                # Shared types
  test/                     # Test setup and helpers
scripts/
  generate-icons.mjs        # Builds favicon.ico and every app icon from the logo
public/
  branding/                 # Logos used in the app
  icons/                    # Favicon and app icons (generated by npm run icons)
vercel.json                 # Security and caching headers
```

## Data and privacy

- All data lives in IndexedDB in the browser you use. Each phone, tablet or browser has its own separate copy, and nothing syncs between devices.
- Clearing the browser's site data, or using **Reset memory**, deletes everything.
- The app asks the browser for persistent storage to reduce the chance of the browser evicting data (iOS can still clear it after long inactivity).

## Security

- No backend, accounts, API keys or environment variables.
- Production responses send a Content-Security-Policy (same-origin only), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict Referrer-Policy and a Permissions-Policy that turns off camera, microphone, location, payment and USB. See [`vercel.json`](vercel.json).
- `.env*` files are gitignored.
- `npm audit --omit=dev` reports no critical or high issues. The remaining low/moderate advisories come from the build-time PWA tooling (Workbox) and aren't shipped to the browser.

## Deployment

Pushes to `main` deploy to production on Vercel. Every other branch gets a preview deployment, which is behind Vercel's login protection.

## Further reading

- [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — data model, queue rules and court layout in more detail
