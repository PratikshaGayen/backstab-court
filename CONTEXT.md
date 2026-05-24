# Backstab Court — Full Project Context

Use this document to onboard any AI assistant into this project. It contains everything needed to understand what was built, how it works, and what comes next.

---

## 1. What is this project?

**Backstab Court** is a multiplayer party game built for GenLayer's community. It's a 10-minute debate game where players argue hot takes and an AI jury of 5 personas delivers live verdicts.

**Built for:** GenLayer's CommunityOngoingSubmit mission — a mini-game that showcases GenLayer's Intelligent Contracts and Optimistic Democracy consensus as core game mechanics.

**Tagline:** "The AI is the judge. The jury is unhinged. Your friends are the witnesses."

---

## 2. How the game works

1. 4-6 players join a room (or fill with bots)
2. Each match has 4 rounds (~10 min total)
3. Each round, one player is the "defendant" assigned a hot take to defend (e.g. "Crypto is just gambling with extra steps")
4. Everyone else (prosecutors) writes one argument for why the take is WRONG
5. The defendant writes one argument for why the take is RIGHT
6. An AI jury of 5 personas (Stern Judge, Drunk Poet, Conspiracy Theorist, Corporate HR, Literal Toddler) judges argument quality and votes GUILTY/INNOCENT/CHAOTIC
7. XP changes hands based on the verdict
8. Final round is double XP
9. If the jury splits, an Appeal triggers with even higher stakes
10. Match ends with leaderboard + earned titles

**Skill element:** The AI judges argument quality, not randomness. Players who write persuasively and target specific persona preferences win more.

---

## 3. Tech stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Contract | Python (GenVM v0.2.16) | AI jury via `prompt_comparative`, XP storage, match state |
| Server | Node.js + TypeScript + Socket.IO | Room management, phase timers, bot AI, contract bridge |
| Frontend | Vite + React + TypeScript | Courtroom UI, real-time updates |
| Shared | TypeScript package | Types, events, phases, title computation |
| Monorepo | pnpm workspaces | All packages linked |

---

## 4. Project structure

```
D:\Genlayer-Game\
├── contract/                    # GenLayer Intelligent Contract
│   ├── backstab_court.py        # Main contract (jury, XP, matches)
│   ├── content/charges.json     # 50 hot take debate topics
│   ├── content/charge_generator.py
│   └── schemas/backstab_court_schema.py
├── server/                      # Node game server
│   ├── src/index.ts             # Express + Socket.IO setup
│   ├── src/rooms/Room.ts        # Core game logic, phase machine, bot integration
│   ├── src/rooms/RoomManager.ts
│   ├── src/rooms/PhaseMachine.ts
│   ├── src/sockets/gateway.ts   # Socket event handlers
│   ├── src/jury/stubJury.ts     # Offline fallback jury (random)
│   ├── src/bots/BotPlayer.ts    # Bot personalities + auto-play
│   ├── src/content/charges.ts   # Weekly rotation logic
│   └── src/contract/client.ts   # GenLayer RPC wrapper
├── web/                         # Vite + React frontend
│   ├── src/pages/Landing.tsx
│   ├── src/pages/Lobby.tsx
│   ├── src/pages/Courtroom.tsx  # Main game UI (phase-driven)
│   ├── src/pages/GlobalLeaderboard.tsx
│   ├── src/components/          # ChargeCard, JuryStream, VerdictBanner, etc.
│   ├── src/hooks/               # useSocket, useRoomState, useGenLayer, etc.
│   └── src/styles.css           # Full dark theme
├── shared/                      # @backstab/shared package
│   └── src/                     # phases.ts, events.ts, types.ts, titles.ts
├── .env                         # Contract address + server config
├── BLUEPRINT.md                 # Full design doc + roadmap
└── package.json                 # pnpm workspace root
```

---

## 5. Current state (what's done)

### Phase 0-4 complete:
- [x] Monorepo scaffold with pnpm workspaces
- [x] Full game loop: lobby → charge → accuse → defend → jury → verdict → match end
- [x] Room system: create, join by code, leave, reconnect
- [x] Phase state machine with timers and early-advance
- [x] Stub jury (offline fallback with 5 persona flavors)
- [x] Real AI jury via GenLayer contract (`prompt_comparative`)
- [x] Appeal system (Supreme Validator when jury splits)
- [x] XP on-chain: TreeMap[Address, u256] for persistent stats
- [x] Bot players: fill slots, auto-play with 5 personality styles
- [x] Hot take debate format (50 curated topics)
- [x] Spectator mode
- [x] Match-end titles (Most Betrayed, Jury's Darling, Chaos Agent, etc.)
- [x] Shareable verdict cards (canvas PNG export)
- [x] Weekly charge rotation (seeded shuffle, no repeats per match)
- [x] Global leaderboard page (reads on-chain stats)
- [x] Polished dark UI with animations
- [x] Auto-rejoin on page navigation

### Contract deployed:
- Address: `0xf9927AbA6918c93bc13F8b0A8ba336a6A288652B`
- Network: GenLayer localnet (`http://localhost:4000/api`)
- Note: Contract needs redeployment with updated jury prompt (hot take format)

---

## 6. How to run locally

```powershell
# Prerequisites: Node 18+, pnpm, Docker (for GenLayer Studio)

# 1. Install deps
pnpm install

# 2. Start GenLayer Studio (separate terminal)
# Containers: genlayer-studio-* (postgres, redis, jsonrpc, workers, frontend, webdriver, explorer)
docker start genlayer-studio-postgres-1 genlayer-studio-redis-1 genlayer-studio-webdriver-1 genlayer-studio-jsonrpc-1 genlayer-studio-consensus-worker-1 genlayer-studio-consensus-worker-2 genlayer-studio-consensus-worker-3 genlayer-studio-frontend-1 genlayer-studio-explorer-1

# 3. Deploy contract (if needed)
node deploy.mjs
# Or paste contract/backstab_court.py into Studio UI at http://localhost:8080

# 4. Update .env with contract address

# 5. Run game
pnpm dev:server    # :4100
pnpm dev:web       # :5173
```

---

## 7. Key technical decisions (from experience)

- Contract uses JSON strings for complex state (list/dict/float/Optional break at deploy)
- `TreeMap[Address, u256]` for per-player XP/wins/losses
- Single `prompt_comparative` call per round (can't call eq_principle twice per method)
- 5 personas simulated in ONE prompt, not 5 separate calls
- Closures can't capture `self` — rebind to locals
- Strip markdown fences from LLM output before JSON.parse
- `eth_gasPrice` patch required in genlayer-js 1.1.8
- Contract must be ASCII-only (no em-dashes) and LF line endings (no CRLF)
- `.gitattributes` enforces LF for Windows safety
- Server falls back to stub jury when CONTRACT_ADDRESS is not set

---

## 8. .env format

```
GENLAYER_RPC_URL=http://localhost:4000/api
CONTRACT_ADDRESS=0x<40-char-hex>
PORT=4100
CORS_ORIGIN=http://localhost:5173
VITE_GENLAYER_RPC_URL=http://localhost:4000/api
VITE_CONTRACT_ADDRESS=0x<same-address>
VITE_SERVER_URL=http://localhost:4100
```

---

## 9. Next goals (in priority order)

### Immediate (before publishing):
1. **Redeploy contract** with updated hot-take jury prompt to Studionet (not localnet)
2. **Host the game server** on Railway/Fly.io/VPS (Socket.IO needs persistent connections)
3. **Deploy frontend** to Vercel (point VITE env vars to hosted server + Studionet RPC)
4. **Fix bot wallet addresses** — bots currently use fake IDs that fail contract validation; need to generate real dummy addresses for on-chain play

### Polish (after first playtest):
5. Page reload recovery (persist player session across socket reconnects)
6. Mobile testing + fixes
7. Favicon + OG image for social sharing
8. Sound effects on verdict reveal
9. "Rematch" button at match end
10. Match history page

### Phase 5 (community/distribution, deferred):
11. Discord bot (start matches from Discord)
12. Match replay viewer
13. Analytics dashboard (most divisive topics, persona vote patterns)

---

## 10. GenLayer-specific reference

- GenLayer docs: https://docs.genlayer.com
- Studio repo: https://github.com/genlayerlabs/genlayer-studio
- genlayer-js SDK: https://www.npmjs.com/package/genlayer-js
- Studio UI: http://localhost:8080 (localnet) or https://studio.genlayer.com (studionet)
- RPC: http://localhost:4000/api (localnet)
- Networks: localnet → studionet → testnet-bradbury
- Validators config: amount ≥ 2 required for consensus (3 recommended)
- Contract SDK pin: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`

---

## 11. File locations on this machine

- Game project: `D:\Genlayer-Game\`
- GenLayer Studio: `C:\Users\PRATIKSHA\genlayer-studio\`
- Previous Predikt project: `D:\Genlayer\`
- Old Studio fork (unused): `C:\Users\PRATIKSHA\genlayer-studio-contrib\`

---

*Last updated: May 13, 2026*
