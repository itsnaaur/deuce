# Deuce — Current implementation (as of this document)

This document describes what is **actually built** in the repository: routes, data model, queue rules, court layout, PWA setup, and navigation. It is meant to stay aligned with the code.

---

## 1. Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Local persistence | **Dexie.js** (IndexedDB) — offline-first roster, courts, settings |
| Live UI updates | `dexie-react-hooks` (`useLiveQuery`) |
| Motion | Framer Motion (queue list animations) |
| PWA | `@ducanh2912/next-pwa` (service worker in production builds) |
| Fonts | **Sora** (display), **IBM Plex Sans** (UI) via `next/font` |

**Build / dev notes**

- `npm run dev` uses **`next dev --webpack`** for stable dev on Windows and to avoid Turbopack cache issues.
- `npm run build` uses **`next build --webpack`** so the PWA plugin (Workbox) runs the same way as in dev tooling expectations.
- `npm run clean` deletes the `.next` folder.

---

## 2. Application structure: four main areas (routes)

The app is organized as **four primary screens**, exposed as four routes.

- **Phones, tablets, iPad, and smaller laptops (`< 2xl`):** bottom tab bar (touch-first, same pattern as mobile)  
- **Wide desktop (`2xl` and up, 1536px+):** left sidebar (“rail”) with collapse; bottom tab bar is hidden

| Route | Purpose |
|-------|---------|
| **`/`** | **Dashboard** — session overview, quick-start links, top leaderboard snapshot. |
| **`/queue`** | **The Roster** — session settings, add players, full roster, fair **waiting** list. |
| **`/war-room`** | **Courts** — build Team A vs Team B, auto-fill suggestions, start/end matches. |
| **`/analytics`** | **Analytics** — full session match history and leaderboard with win rates. |

Shell layout: `src/app/(app)/layout.tsx` — wraps all three with navigation and content inset (`md:pl-52`, `lg:pl-60`) when the sidebar is visible.

---

## 3. Data model (Dexie / IndexedDB)

Database name: `deuce-db` (see `src/lib/db.ts`).

### 3.1 `Player`

| Field | Meaning |
|-------|---------|
| `id` | UUID |
| `name` | Display name |
| `gender` | `Male` \| `Female` |
| `skillLevel` | See **§4 Skills** |
| `isActive` | If `false`, player is excluded from queue logic (organizer “off”). |
| `isOnBreak` | If `true`, treated as temporarily away from the queue. |
| `gamesPlayed` | Integer; incremented when a match on a court is **ended** with that player on the court. |
| `waitStartedAt` | Timestamp (ms) used for **wait time** and tie-breaking in the queue. |
| `createdAt` / `updatedAt` | Timestamps |

`Mixed` is intentionally **not** a player gender value. It is reserved for future match-composition logic (e.g., smart team suggestions for mixed doubles).

### 3.2 `Court`

| Field | Meaning |
|-------|---------|
| `id` | e.g. `court-1` |
| `label` | e.g. `Court 1` |
| `slots` | Four slots, positions **1–4** (see **§6 Court arrangement**). |
| `isActive` | `true` while a match is running on that court. |
| `matchStartedAt` | Set when **Start match** is pressed (optional for future timers). |

### 3.3 `SessionSettings` (single row `id: "default"`)

| Field | Meaning |
|-------|---------|
| `skillMode` | `recreational` \| `competitive` — which skill dropdown applies when adding players. |
| `courtCount` | Number of courts (1–10); courts are created/removed to match. |
| `randomStartUsed` | After **Shuffle first round**, set so shuffle cannot run again in that session state. |

### 3.4 `SessionMatch`

Stored in `sessionMatches` table.

| Field | Meaning |
|-------|---------|
| `id` | UUID |
| `courtId` / `courtLabel` | Court reference and display label |
| `teamAPlayerIds` / `teamBPlayerIds` | Two-player team rosters at match end |
| `scoreA` / `scoreB` | Entered result when ending a match |
| `winner` | `A` \| `B` \| `Draw` |
| `startedAt` / `endedAt` | Match start and end timestamps |
| `durationMs` | Computed from `endedAt - startedAt` |

### 3.5 `Session`

Stored in `sessions` table.

| Field | Meaning |
|-------|---------|
| `id` | UUID |
| `name` | Human label (`Session 1`, `Session 2`, ...) |
| `sequence` | Incrementing session number |
| `status` | `active` \| `ended` |
| `startedAt` / `endedAt` | Session lifetime timestamps |

---

## 4. Skills (leveling)

The product supports **two skill modes** (settings toggled on **Queue**): **Recreational** and **Competitive**.

### 4.1 Recreational mode (`skillMode === "recreational"`)

When adding a player, skill is one of:

- **Beginner**
- **Intermediate**
- **Advanced**

### 4.2 Competitive mode (`skillMode === "competitive"`)

When adding a player, skill is one of:

- **A** through **K** (eleven letter grades)

Types are defined in `src/lib/types.ts` (`BasicSkill`, `AdvancedSkill`, `SkillLevel`, `SkillMode`).

### 4.4 Hidden normalized skill baseline

To keep Smart Matchmaker fair when organizers switch `skillMode` mid-session, balancing logic uses one shared hidden numeric baseline (`src/lib/skill.ts`) across both label sets:

- Recreational: `Beginner=1`, `Intermediate=5`, `Advanced=10`
- Competitive: `A=11` down to `K=1`

All team-gap and skill-strength math now uses this same baseline so mixed historical labels still compare consistently.

### 4.5 Non-linear team power (tactical balancing)

Team balancing now uses a non-linear power curve (`src/lib/skill.ts`) instead of pure linear sums:

- Team power per player: `power = normalizedSkill^1.35`
- Team power per side: `power(p1) + power(p2)`
- Pairing selection minimizes absolute team-power gap.

This makes top-end skill mismatches weigh more heavily, so a single elite player cannot be neutralized too easily by linear averaging.  
The exponent is tunable via `TEAM_POWER_EXPONENT` if real session outcomes suggest stronger or softer weighting.

### 4.3 Queue ordering and skill

Primary queue order is **not** by skill first. Skill is used as a **tertiary** tie-breaker after `gamesPlayed` and `waitStartedAt` (see `src/lib/queue.ts`):

1. Lower **`gamesPlayed`** first.  
2. Earlier **`waitStartedAt`** first (longer wait = smaller timestamp sorts earlier).  
3. Then a fixed **level order** (letters A…K first, then Beginner / Intermediate / Advanced for recreational labels).  
4. Then **name** (locale compare).

---

## 5. Queue behavior (fair wait list)

A player appears in the **waiting** list if:

- `isActive === true`
- `isOnBreak === false`
- They are **not** assigned to any court slot (`playerId` on any court)

Sorting uses `sortPlayersForQueue` (`src/lib/queue.ts`) with a priority score:

`PriorityScore = (gamesPlayed * 100) - waitMinutes`  
Lower score = higher priority to play.

Anti-stagnation override is also applied: if a player waits at least **30 minutes**, they are prioritized ahead of players below that threshold, regardless of games-played multiplier. This prevents long-wait lockout during busy sessions.

**Shuffle first round** (Queue page): enabled only when there are **≥10 active** players and `randomStartUsed` is false. It shuffles up to **20** eligible waiting players and staggers their `waitStartedAt` so order is randomized once; then `randomStartUsed` is set.

## 5.1 Session lifecycle

- Sessions are explicit and user-controlled.
- Dashboard shows current session status and provides **Start session** / **End session**.
- Ending a session marks it as `ended`, clears active courts, resets per-session player counters (`gamesPlayed`), and resets first-round shuffle state.
- Starting a new session creates the next numbered entry (`Session N`).
- When there is **no active session**, waiting queue calculations are paused (queue and Dashboard “Next up” are intentionally empty).
- Starting a session prompts organizers to optionally clear the current player list when players already exist.
- Match records are tagged with `sessionId`, allowing per-night history and leaderboards.

---

## 6. Court arrangement (doubles, bird’s-eye)

Each court has **four slots**, stored as `position` **1 | 2 | 3 | 4**. The UI draws a **top-down** doubles court with a **vertical net** (left vs right half).

### 6.1 Team pods (UI)

| Team | Slots in UI | Internal positions |
|------|-------------|--------------------|
| **Team A** | Player 1, Player 2 | 1, 2 |
| **Team B** | Player 1, Player 2 | 3, 4 |

The UI no longer requires “rear/net” role selection. Organizers only place players into Team A or Team B, reducing setup friction.

Implementation reference: `src/components/badminton-court.tsx` (`TeamPod` + two player slots per side).

### 6.2 Match lifecycle

- **Assign:** only when the court is **not** active; dropdowns pick from **current waiting** players into Team A/Team B slots.  
- **Auto-fill:** available only on an **empty, non-live** court with at least 4 waiting players. Opens a confirmation modal with suggested teams and wait-time reasoning.  
- **Remove:** clears a slot when not active.  
- **Start match:** sets `isActive` and `matchStartedAt`.  
- **End match:** opens a score-entry prompt (`Score A` vs `Score B`), records result + duration in `sessionMatches`, then increments `gamesPlayed`, resets `waitStartedAt`, clears slots, clears `isActive`.

Auto-fill confirmation calls a single action that assigns all 4 players and starts the match immediately.

Auto-fill start is transaction-guarded to avoid race conflicts:
- Re-checks target court is still empty and not live.
- Re-checks all suggested players are still eligible (`isActive` and not `isOnBreak`).
- Re-checks none of the suggested players were assigned to another court in the meantime.
- If any check fails, the start is cancelled and organizer is prompted to auto-fill again.

Auto-fill team balancing for top-4 priority players evaluates all valid 2v2 pairings and chooses the split with the smallest total skill gap.
Suggestion modal includes fairness transparency:
- Per-player “Why Them?” badges (`Longest Wait` for 20+ min wait, `Fresh` for lowest games played).
- Fairness score (0–100%) derived from team skill-gap.
- Yellow warning/disclaimer when balancing heavily favors queue fairness over skill parity.
- Queue-to-court motion uses Framer Motion shared `layoutId` so a selected player tile animates from queue list into the assigned court slot.

---

## 7. Pages — what each screen contains

### 7.1 Dashboard (`/`)

- Branding / short intro.  
- **Stats:** roster size, active count, waiting count, live courts vs total courts.  
- **Next up:** up to four names from the top of the fair queue.  
- Quick start buttons to **The Roster** and **Courts**.
- **Live Performance** cards:
  - **Win Streaks:** highlights players on 3+ consecutive wins (🔥).
  - **Giant Killer:** detects upset wins where lower-skill team beats higher-skill team.
  - **Session MVP:** best point spread across recorded scores.

Data: `useDeuceSession()` (`src/hooks/use-deuce-session.ts`).

### 7.2 The Roster (`/queue`)

- **Skill mode** and **court count** (1–10).  
- **Shuffle first round** (rules above).  
- **Add player:** name, gender, skill (depends on mode).  
- **Roster:** list all players; toggles **Active** / **Off** and **Here** / **Break**.  
- **Waiting:** fair queue list via **`QueuePanel`** — same ordering rules as §5.

### 7.3 Courts (`/war-room`)

- Lists all courts (sorted by label).  
- Each court: bird’s-eye graphic + two team pods (A/B), manual slot assignment, **Auto-fill**, **Start match** / **End match**.

### 7.4 Analytics (`/analytics`)

- Session selector supports active session, specific previous sessions, or all sessions.
- Leaderboard sorted by win rate (`wins / (wins + losses)`) from selected session scope.
- Full session history list: teams, final score, winner, and match duration.

**Adaptive layout (Tailwind breakpoints: `md` = 768px, `lg` = 1024px, `2xl` = 1536px):**

| Viewport | Layout (“feel”) | Behavior |
|----------|-----------------|----------|
| **&lt; `2xl` (phones, tablets, iPad, smaller laptops)** | **Umpire (touch)** | Same pattern as phone: **stacked courts**, **`QueueDrawer`** from the floating queue button, **`variant="umpire"`** cards. From **`md`**, typography, spacing, court graphics, and controls **scale up** for larger screens; **no** sticky side queue (that layout is reserved for **`2xl+`** desktop). |
| **`2xl+` (wide desktop)** | **Live board** | **One court at a time** (large **`variant="umpire"`** card, max width capped) with **tabs** to switch courts; **`LiveSidePanel`** on the right with **session stats** and **games-played leaderboard**. |

Shared pieces: `src/components/queue/queue-panel.tsx`, `src/components/queue/queue-drawer.tsx`, `src/components/session/live-side-panel.tsx`. Court SVG gradient IDs are **per-instance** (`useId`) so multiple courts do not clash.

---

## 8. Navigation implementation

- **Files:** `src/components/navigation/main-nav.tsx`, `src/components/navigation/app-shell.tsx`
- **`AppShell`:** wraps app routes; applies **main content padding-left** (not margin) to clear the fixed sidebar so the column does not overflow horizontally; hosts **`AppTabBar`**.
- **`AppTabBar`:** bottom navigation; visible **below `2xl`** (phones, tablets, iPad).
- **`AppSidebarNav`:** left rail **from `2xl` only** — **expanded** (`w-60` at desktop widths) or **collapsed** to icon-only (`w-[4.5rem]`). Toggle persists in **`localStorage`** (`deuce-sidebar-collapsed`).
- **Re-export:** `src/components/navigation/app-tab-bar.tsx` re-exports `AppTabBar` for compatibility.

---

## 9. PWA

- **Manifest:** `src/app/manifest.ts` (Next.js Metadata Route → `/manifest.webmanifest`).  
- **Icons:** `public/icons/icon.svg`.  
- **Service worker:** generated into `public/` on **production** `next build` (ignored in git via `.gitignore` where applicable).  
- **Development:** PWA plugin is **disabled** (`NODE_ENV === "development"`) so caching does not fight hot reload.

### 9.1 Long-session reliability

- **Wake Lock (Courts):** while a session is active, the app requests `screen` wake lock on the Courts view and re-requests on tab visibility return. This reduces organizer friction from device sleep mid-flow.
- **Court render optimization:** court slot/player mapping is memoized in `badminton-court.tsx` and the court component is wrapped with `memo` to reduce repeated work during long sessions with many court updates.

Root layout sets `viewport.themeColor`, `appleWebApp`, and `data-scroll-behavior="smooth"` on `<html>` (paired with CSS in `globals.css` for Next.js scroll behavior).

---

## 10. Styling / UX conventions

- **Shell / brand:** dark navy used for the **desktop sidebar** (`2xl+`) only.  
- **Canvas:** light dotted background for **Home, Queue, and War room** (all base routes).  
- **Court:** green gradient + white lines in SVG (`badminton-court.tsx`).
- **Queue wait warning:** players waiting longer than 20 minutes are highlighted amber in queue lists.
- **Brand assets:** project logos are stored in `public/branding/` (`deuce-icon-logo.png`, `deuce-word-logo.png`).
- **Glass surfaces (Tailwind 4 tokens):** queue drawer backdrop/panel now use CSS variable tokens (`--glass-overlay`, `--glass-surface`, `--glass-border`) with backdrop blur for a premium glassmorphism layer.

---

## 11. Out of scope / not implemented yet (clarification)

The following appear in the product vision but are **not** fully implemented in code as of this document:

- Mandatory **rest period** after a match before re-assigning.  
- **Drag-and-drop** assignment (assignment is via dropdowns).  
- **Cloud sync**, auth, multi-device real-time.  
- **Tournament brackets**.

---

## 12. File map (quick reference)

| Area | Paths |
|------|--------|
| Routes | `src/app/(app)/page.tsx`, `queue/page.tsx`, `war-room/page.tsx`, `analytics/page.tsx` |
| Session logic | `src/hooks/use-deuce-session.ts` |
| DB | `src/lib/db.ts`, `src/lib/types.ts` |
| Queue sort | `src/lib/queue.ts` |
| Court UI | `src/components/badminton-court.tsx` |
| Nav | `src/components/navigation/main-nav.tsx` |
| Views | `src/components/views/home-view.tsx`, `queue-view.tsx`, `war-room-view.tsx`, `analytics-view.tsx` |
| Queue UI | `src/components/queue/queue-panel.tsx`, `queue-drawer.tsx` |
| Live board | `src/components/session/live-side-panel.tsx` |

---

*This file should be updated when behavior or routes change.*
