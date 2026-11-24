# Retro Quest

A real-time web app for running a 45 to 50-minute remote sprint retrospective as a cosy fantasy adventure. Each player joins from their own browser. The host moves the party across a world map from phase to phase, and the session ends with 1 to 3 agreed action items, exported as Markdown for Jira or Confluence.

No accounts: you join with a 4-letter room code and a display name.

## How it works

- **Next.js (App Router) on Vercel.** The UI and the API live in one project.
- **One `Room` object per session**, stored in **Upstash Redis** as one JSON value with a version number and a 7-day TTL. Writes use check-and-set on the version, so players writing in the same second never overwrite each other.
- Clients `POST` intents to `/api/rooms/<code>/action`. The server validates them in a pure reducer (`lib/shared/reducer.ts`) and saves the result.
- After every change the server publishes `{ version }` on the **Ably** channel `room-<code>`. Each client then fetches **its own filtered view** from `GET /api/rooms/<code>/view`. All visibility rules (hidden cards, anonymity, hidden votes) live in one function, `viewFor` in `lib/shared/view.ts`.
- When real-time is unavailable, clients poll every 3 seconds.

```
app/                     pages and API route handlers
components/              game UI, one file per phase in components/phases
lib/shared/              types, config (all game rules), reducer, viewFor, export
lib/server/              Redis store, Ably ping, room service
tests/unit/              Vitest: reducer, visibility rules, concurrent writes
tests/e2e/               Playwright: full quest with 5 and 10 browsers
```

Game rules (coins, Boss HP, XP amounts, default timings) are in [`lib/shared/config.ts`](lib/shared/config.ts). Design decisions are in [`DECISIONS.md`](DECISIONS.md).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without environment variables the app uses an **in-memory store and polling**, so you can do a dry run in several browser tabs (use a private window per player) without creating any accounts.

## Tests

```bash
npm test               # Vitest: reducer, viewFor visibility rules, export, concurrent writes
npx playwright install chromium   # once
npm run test:e2e       # Playwright: builds the app, then runs a full quest with 5 and 10 browsers
npm run typecheck
npm run lint
```

The Playwright run records every `/view` response and fails if any client receives another player's card text during a writing round, or the author of someone else's anonymous card.

## Deploy to Vercel

1. Import the GitHub repository into Vercel (framework: Next.js; no build settings needed).
2. Add **Upstash Redis** from the Vercel Marketplace (Storage → Upstash → Redis) and connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` work too.
3. Create an Ably app (free tier) and add its root API key as a **Secret** `ABLY_API_KEY` for Production and Preview (`npx vercel@latest env add ABLY_API_KEY --environment production`). The key needs the *publish* and *subscribe* capabilities, plus permission to issue tokens. The app uses Ably's `@ably/pubsub-server` (publishing, token signing) and `@ably/pubsub-device` (browsers) packages; accounts on Ably's MAU pricing reject the older `ably` package. Each player counts as one monthly active user on Ably.
4. Deploy. Without Redis the API refuses to run on Vercel, because in-memory state would split across function instances.

| Variable | Required | Purpose |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` | yes on Vercel | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | yes on Vercel | Redis REST token |
| `ABLY_API_KEY` | recommended | Real-time "something changed" ping. Without it, clients poll every 3 s |
| `RATE_LIMIT_JOIN_PER_MIN` | no (default 20) | Room lookups and joins per IP per minute |
| `RATE_LIMIT_CREATE_PER_MIN` | no (default 10) | Rooms created per IP per minute |

There are no analytics or other external services.

## Hosting your first Retro Quest

**Before the call (2 minutes).** Open the app, enter your name, keep **Host also plays** on if you want to take part, pick an avatar and press **Create room**. Copy the join link (`/<CODE>`) from the Town Gate.

**0 · Town Gate (lobby).** Paste the link in the call chat. Players enter a name and pick an avatar, and they appear in the party bar at the top. When everyone is in, press **Start the quest**.

**1 · The Tavern (4 min, check-in).** Everyone picks the character class that matches how the sprint felt, with an optional one-line comment. You see how many have chosen, not what. Press **Reveal class picks**: every avatar turns into its class. Ask one or two people about their pick.

**2 · Monster Woods (4 + 7 min, what got in the way).** Start the timer. Everyone writes Monster cards. Each player only sees their own text; the others show face-down. Players can post anonymously and tick **I'm done writing**. Press **Reveal cards**: the cards flip over. Start the 7-minute discussion timer. Use **Spotlight** to enlarge a card for everyone and **Mark discussed** to dim it.

**3 · Treasure Cave (4 + 5 min, what went well)** and **4 · Potion Shop (3 + 4 min, what helped / ideas to try)** work the same way. Treasure comes after the Monsters so the reflection ends on a positive note.

**5 · The War Table (3 + 2 min, group and vote).** First group duplicate Monsters: drag one card onto another, or tick cards and press **Merge selected**. Players can suggest merges, which you accept or dismiss. Use **Rename** to give a group a clearer title. Press **Next: open voting**: everyone spends 3 gold coins and may stack them. You see how many coins each person has spent, not where. Press **Reveal votes**: the coins drop onto the cards and the cards sort by total.

**6 · Boss Lair (10 min, action items).** The top-voted Monster becomes the Boss. On a tie, you pick. The team writes **Attacks** (action items), each with a hero (owner) and an optional due date. Only Attacks with a hero damage the Boss: the first takes 60 HP, each next one 20. Aim for 1 to 3 good actions. When you agree, press **Defeat the Boss**. With time left, **Fight next Monster** brings out a mini-boss.

**7 · Loot Room (2 min, wrap-up).** The summary shows the check-in, all cards, vote results and the action items. Press **Copy as Markdown** and paste it into Confluence or a Jira ticket, or **Download retro-YYYY-MM-DD.md**. Finally, press **End session** in the host panel: the room becomes read-only and is deleted after 7 days.

**Good to know**

- Only the host moves the party: **Next / Back** in the host panel, or click a location on the world map. Moving past a writing round reveals its cards.
- Timer: **Start**, **Pause/Resume**, **+1 min**, **Reset**, or set any number of minutes. At 0 it pulses (with a sound, if that player turned sound on). Nothing locks automatically.
- If a player refreshes or drops out, they come straight back with the same name, avatar and cards.
- If you (the host) lose your connection, the session pauses. Reopen the room link to continue. After 2 minutes away, a player can press **Claim host**.
- You can remove a player from the host panel.

## Licences

| Asset | Source | Licence |
| --- | --- | --- |
| Pixel adventurers, class sprites, location/card icons, coins, Boss creatures | Original artwork drawn in code (`components/art`) for this project | Same as this repository |
| Sound effects | Synthesized at runtime with the Web Audio API (`lib/client/sound.ts`); no audio files | Same as this repository |
| "Press Start 2P" font by CodeMan38 | Google Fonts, self-hosted at build time via `next/font` | SIL Open Font License 1.1 |

No assets from existing games are used.
