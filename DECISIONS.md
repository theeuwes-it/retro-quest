# Decisions

Where the handoff spec was silent or had to bend, the simpler option was chosen. Each item is recorded here.

## Confirmed with the product owner

- **Real-time: Ably.** Vercel Functions now support WebSockets, but each connection is cut off at the function's max duration (5 min on Hobby) and fan-out across instances still needs Redis pub/sub. A managed ping (Ably) is less code and more robust. Clients fall back to polling `/view` every 3 s.
- **Ably packages:** the server uses `@ably/pubsub-server` and browsers use `@ably/pubsub-device`, pinned at 3.1.0. Ably accounts on MAU pricing reject the classic `ably` package (error 40168). Browser tokens carry the player id as client ID, which MAU accounts require.
- **Hosting:** Vercel, no SSO. **Git:** one commit per milestone, pushed to `main`.

## Architecture

- **One Next.js project**, not a monorepo (the spec's suggested structure is a single project). Shared code lives in `lib/shared`, server-only code in `lib/server`.
- **Party XP is derived, not stored.** `partyXp(room)` computes it from cards, picks, coins, Attacks and locations reached, so it can never drift. The `partyXp` field from the spec's `Room` type was dropped. The formula is in `lib/shared/config.ts`.
- **Write retries: up to 8 attempts with jitter** (the spec said 3). With 10+ players adding cards in the same instant, 3 attempts can run out. The client also retries a `409 busy`.
- **Presence lives in a separate Redis hash** (`rq:presence:<code>`), so heartbeats never conflict with game writes. Every `/view` call records presence.
- **The in-memory store refuses to run on Vercel.** Memory is per function instance there, so rooms would silently split. Without Redis env vars on Vercel, the API answers `503`.
- **Env var names:** both `UPSTASH_REDIS_REST_URL/TOKEN` (spec) and `KV_REST_API_URL/TOKEN` (what the Vercel Marketplace Upstash integration injects) work.

## Game rules

- **SubPhase has more values:** `active | writing | revealed | grouping | voting`. The War Table runs grouping → voting → revealed. The full list of steps is `STEPS` in `config.ts`.
- **What is revealed is tracked per content type** (`room.revealed.tavern/monster/treasure/potion/votes`), not inferred from `subPhase`. Moving the party past a step reveals it, so nothing stays hidden forever if the host skips the Reveal button.
- **`card:add` uses `cardType`**, not `type`, because `type` is already the action name in the request body.
- **Extra events:** `player:doneWriting`, `player:remove`, `host:claim`, `group:dismiss`.
- **Hidden anonymous cards** appear face-down in a separate "Mysterious Stranger" pile, without `authorId`. (Someone watching the counts change in real time could still guess an author from timing. That is inherent to showing live counts.)
- **After the vote reveal only totals are sent**, never who put coins where.
- **Grouping is allowed during voting too.** Coins on merged cards move to the group, and on ungroup they move back to the first card.
- **Boss selection:** the Boss is picked automatically only when one Monster or group has the unique highest total above 0. Otherwise the host picks. The host can swap a Boss that has no Attacks yet. A defeated Boss shows 0 HP.
- **Attacks are collaborative:** anyone can add, edit or delete them (delete only while the Boss is undefeated). Any member can own one, including a host who doesn't play. A defeated Boss must keep at least one owned Attack.
- **The timer never starts by itself.** Each step loads its default duration and the host presses Start. Steps without discussion time (Tavern reveal, vote reveal) have no timer.
- **Names are unique per room** (case-insensitive). Avatars are unique until all 12 are taken, then they may repeat (name-tag colours tell people apart). The join page preselects a random free avatar, so simultaneous joins rarely collide.
- **Late joiners** may join in any phase except after the session has ended.
- **Removing a player** keeps their cards, and removes their Tavern pick, votes and suggestions. Attacks they owned go back to "needs a hero".
- **Abuse guards:** at most 40 members per room and 30 cards per player per card type.

## Host transfer and presence

- A member counts as **offline after 75 s** without a view refresh (clients refresh every 8 s). The threshold is above 60 s because browsers throttle timers in hidden tabs to about once a minute. Closing a tab is detected immediately through a `sendBeacon` to `/api/rooms/<code>/leave`.
- When the host is offline, **the session pauses**: the first player view that notices freezes a running timer.
- **Claim host** becomes available 2 minutes after the host went offline. Claiming rotates the room's host token, so the old host comes back as a regular member (their own player token still works).
- A host who chose **not to play** still has a member record (`plays: false`): no class, cards or coins.

## Security

- **Room codes** use letters only, without I, L and O (23⁴ ≈ 280k codes). Looking up a room and joining it are rate-limited to 20 per minute per IP. Rejoining with a stored token doesn't count, since the token is secret. Creating rooms is limited to 10 per minute per IP.
- **Tokens** are 192-bit random values. `hostToken` and player tokens are never sent in a view (covered by unit tests).

## Questing names

- **Name suggestions are generated in the browser**, not by an AI service: no API key, no cost, no latency, and players' names never leave the app (keeping the spec's "only Redis and the real-time provider" rule). `lib/shared/fantasyNames.ts` combines the typed first name with epithets, titles, places and fantasy surnames.
- **Names follow the picked character.** Each of the 12 avatars has its own vocabulary (`NAME_STYLES`): a Knight gets "Sander the Gallant" or "Sandamir Lionhelm", a Witch "Sander of Nightshade". The Tavern classes can't drive the name, because they are chosen after joining. The forms now ask for the character first and the name second, so the suggestions visibly follow the pick. A host who doesn't play gets a generic set.
- Suggestions are deterministic per name and avatar, so they don't flicker while typing. "More names" gives a fresh set, and every suggestion fits the 24-character limit.

## Look and sound

- **No Framer Motion:** CSS keyframes cover flips, coin drops, Boss shakes and confetti, each under 800 ms. With `prefers-reduced-motion` they become fades.
- **Sounds are synthesized** with the Web Audio API (no audio files to license). Off by default, with a toggle per player.
- **All art is original SVG drawn in code:** pixel adventurers on a 16×16 grid, flat location/card icons, three Boss creatures.
- **Export is built in the browser** from the player's own filtered view, so the anonymity rules apply to the export automatically.
- **Ended rooms** keep their 7-day TTL from the last write, which is the moment the session ended.
