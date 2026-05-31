# Project Overview: Backstab Court

A 10-minute multiplayer courtroom party game where players debate hot takes and an AI jury of 5 personas delivers live verdicts. Built on GenLayer to showcase Intelligent Contracts and Optimistic Democracy consensus.

---

## Repository Layout

```
d:\Genlayer-Game\
├── package.json              # pnpm workspace root, dev/build scripts
├── pnpm-workspace.yaml       # workspace: web, server, shared
├── pnpm-lock.yaml
├── .env                      # Contract addr, RPC URL, ports, private key
├── .env.example              # Template for .env
├── .dockerignore
├── .gitattributes
├── .gitignore
├── Dockerfile                # Multi-stage: node:22-alpine → server only
├── README.md
├── HOW-TO-PLAY.md
├── ARCHITECTURE.md           # Detailed architecture doc
├── BLUEPRINT.md              # Full design document and roadmap
├── CONTEXT.md                # Full context for AI assistants
├── PROJECT_OVERVIEW.md       # This file
├── .claude/                  # Claude CLI config
├── .github/agents/           # GitHub agent config
├── contract/                 # GenLayer Intelligent Contract (Python)
│   ├── backstab_court.py     # Main contract (~628 lines)
│   ├── content/
│   │   ├── charges.json      # 100 hot-take charges (source of truth)
│   │   └── charge_generator.py
│   ├── deploy/
│   │   ├── deploy.ts         # Deployment script
│   │   └── verify.ts         # Contract verification
│   └── schemas/
│       └── backstab_court_schema.py  # JSON-RPC schema
├── server/                   # Game server (Node.js + TypeScript)
│   └── src/
│       ├── index.ts
│       ├── bots/BotPlayer.ts
│       ├── content/
│       │   ├── charges.ts    # Weekly charge rotation logic
│       │   └── charges.json  # Embedded copy (deployed with server)
│       ├── contract/client.ts
│       ├── jury/stubJury.ts
│       ├── rooms/
│       │   ├── Room.ts
│       │   ├── RoomManager.ts
│       │   └── PhaseMachine.ts
│       └── sockets/gateway.ts
├── web/                      # Frontend (Vite + React + TypeScript)
│   ├── index.html
│   ├── vite.config.ts
│   ├── vercel.json           # SPA rewrite rules for Vercel deploy
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css
│       ├── components/       # AccusationInput, ChargeCard, DefenseInput,
│       │                     # JuryStream, Leaderboard, PhaseTimer,
│       │                     # VerdictBanner, VerdictCard
│       ├── hooks/            # useSocket, useRoomState, useGenLayer,
│       │                     # useWalletRegistration
│       ├── lib/              # socket.ts, identity.ts, storage.ts
│       └── pages/            # Landing, Lobby, Courtroom, GlobalLeaderboard
└── shared/                   # Shared types/constants (TypeScript)
    └── src/
        ├── types.ts
        ├── events.ts
        ├── phases.ts
        └── titles.ts
```

---

## Architecture Diagram

```
                        Browser (Vite + React 18)
                   ┌───────────────────────────────────────┐
                   │  Landing → Lobby → Courtroom           │
                   │  8 UI components                       │
                   │  4 hooks (socket, room, genlayer,      │
                   │          wallet-registration)          │
                   │  3 lib (socket, identity, storage)     │
                   └───────────┬───────────────────────────┘
                               │ Socket.IO (WebSocket)
                               │ Events: create/join/spectate room,
                               │   start_match, add_bots,
                               │   submit_accusation, submit_defense
                               │ Push: room_state, phase_change,
                               │   jury_bubble, verdict, match_end
                  ┌────────────▼──────────────────────────────┐
                  │    Game Server (Node.js + Express)       │
                  │            Port :4100                      │
                  │                                           │
                  │  ┌──────────┐  ┌──────────────────┐     │
                  │  │RoomManager│  │  Socket Gateway   │     │
                  │  └────┬─────┘  └──────────────────┘     │
                  │       │                                  │
                  │  ┌────▼─────┐                           │
                  │  │   Room    │                          │
                  │  │ - Players │                          │
                  │  │ - PhaseMachine                      │
                  │  │ - BotPlayers                        │
                  │  │ - WalletMap                         │
                  │  │ - runJury()                         │
                  │  └────┬──────┘                          │
                  │       │ genlayer-js RPC                 │
                  │  ┌────▼──────┐                          │
                  │  │ Contract  │                          │
                  │  │  Client   │──────────────────────────│──
                  │  └───────────┘                          │
                  └─────────────────────────────────────────┘
                                                              │
                                                              ▼
             ┌──────────────────────────────────────────────────┐
             │       GenLayer Intelligent Contract (Python)      │
             │                 BackstabCourt                    │
             │            (GenVM v0.2.16)                        │
             │                                                   │
             │  Storage: matches_json, charges_pack_json,        │
             │           xp_total (TreeMap), wins, losses        │
             │                                                   │
             │  create_match()      → register match + players   │
             │  submit_round()      → AI jury via                │
             │                         prompt_comparative        │
             │  appeal_round()      → Supreme Validator          │
             │                         tiebreaker                │
             │  get_leaderboard()   → on-chain XP read           │
             └──────────────────────┬────────────────────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────┐
                     │ 3× GenLayer Validators   │
                     │ (Optimistic Democracy)   │
                     │ Each runs LLM prompt     │
                     │ independently            │
                     └─────────────────────────┘
```

---

## Package Details

### `@backstab/shared` — Shared Types & Constants

| | |
|---|---|
| **Language** | TypeScript |
| **Entry** | `src/index.ts` |
| **Build** | `tsc` → `dist/` |
| **Dependencies** | None |

**Files:**
- `types.ts` — Core types: `Player`, `RoomState`, `RoundState`, `Charge`, `Accusation`, `Defense`, `Verdict`, `PersonaVerdict`, `VerdictOutcome`, event payloads
- `events.ts` — Socket.IO event name constants (client→server `CEvent`, server→client `SEvent`)
- `phases.ts` — Phase enum (`LOBBY → CHARGE → ACCUSE → DEFEND → JURY → VERDICT → MATCH_END`), phase durations, game config (`MIN_PLAYERS=2`, `MAX_PLAYERS=6`, `ROUNDS_PER_MATCH=2`, `BASE_XP_STAKE=10`)
- `titles.ts` — `computeTitles()` for post-match titles (Most Betrayed, Jury's Darling, Chaos Agent, Silver Tongue, Scapegoat)

---

### `@backstab/server` — Game Server

| | |
|---|---|
| **Runtime** | Node.js ≥18, TypeScript 5.4 |
| **Framework** | Express 4.19 + Socket.IO 4.7 |
| **Blockchain** | genlayer-js 1.1.8, viem 2.48 |
| **Port** | 4100 (default) |
| **Dev** | `tsx watch src/index.ts` |

**Source structure:**

| File | Role |
|---|---|
| `src/index.ts` | Bootstrap: Express + CORS, Socket.IO, RoomManager, HTTP listener |
| `src/rooms/RoomManager.ts` | `Map<RoomId, Room>`, 6-char nanoid room codes, idle cleanup (60s) |
| `src/rooms/Room.ts` | **Core game logic** (~576 lines): player lifecycle, bot management, phase progression, input collection, jury execution (contract → stub fallback), wallet mapping (socket→keccak256→address), match end & leaderboard |
| `src/rooms/PhaseMachine.ts` | Pure state machine driving the 7-phase game loop |
| `src/sockets/gateway.ts` | All Socket.IO event handlers: create/join/spectate, start match, add bots, submit accusations/defense, register wallet, disconnect |
| `src/contract/client.ts` | GenLayer RPC wrapper: `createMatch`, `submitRound`, `appealRound`, `readContract`, with receipt parsing and malformed-JSON fallback extraction |
| `src/bots/BotPlayer.ts` | 8 bot personalities (AgentChaos, DramaLlama, SirGoofington, JudgeBot3000, TinfoilTed, VibeCheck, ColdLogic, MayorMischief) across 5 style categories |
| `src/jury/stubJury.ts` | Offline fallback jury: random verdicts, persona-flavored reasoning, XP math, appeal detection |
| `src/content/charges.ts` | Weekly charge rotation: seeded shuffle of 100 charges, no-repeat-per-match |

---

### `@backstab/web` — Frontend

| | |
|---|---|
| **Build** | Vite 5.2 + React 18.3 |
| **Routing** | React Router 6.23 |
| **Transport** | Socket.IO client 4.7, genlayer-js 1.1.8 |
| **Dev port** | 5173 → `http://localhost:5173` |

**Routes:**

| Route | Component | Description |
|---|---|---|
| `/` | `Landing.tsx` | Name entry, how-to-play steps, leaderboard link |
| `/lobby` | `Lobby.tsx` | Create/join rooms, spectate mode |
| `/room/:roomId` | `Courtroom.tsx` | Main game UI: all 7 phases, auto-rejoin |
| `/leaderboard` | `GlobalLeaderboard.tsx` | On-chain XP/wins/losses from contract |

**Components:** `ChargeCard`, `AccusationInput`, `DefenseInput`, `JuryStream` (animated persona bubbles), `VerdictBanner`, `VerdictCard` (shareable PNG), `Leaderboard` (sidebar), `PhaseTimer` (countdown)

**Hooks:** `useSocket` (singleton connection), `useRoomState` (all server events), `useGenLayer` (client with localStorage keypair), `useWalletRegistration` (auto-register wallet on join)

**Lib:** `socket.ts` (singleton init), `identity.ts` (display name in localStorage), `storage.ts` (safe localStorage wrapper)

---

### `contract/` — GenLayer Intelligent Contract

| | |
|---|---|
| **Language** | Python (GenVM v0.2.16) |
| **SDK** | `py-genlayer@1jb45aa8ynh2...` |
| **File** | `backstab_court.py` (~628 lines) |

**Storage:**
- `matches_json: str` — All match data (JSON-serialized)
- `charges_pack_json: str` — Hot take pool
- `owner: Address` — Contract deployer
- `game_server: Address` — Authorized server
- `xp_total: TreeMap[Address, u256]` — Per-player XP
- `wins: TreeMap[Address, u256]` — Per-player wins
- `losses: TreeMap[Address, u256]` — Per-player losses

**Methods:**

| Method | Access | Description |
|---|---|---|
| `set_game_server(addr)` | owner | Rotate authorized server |
| `set_charges_pack(json)` | owner | Replace weekly charges |
| `create_match(addrs_json)` | server | Register match + players |
| `submit_round(match_id, round, charge, defendant, accusations, defense)` | server | AI jury via `prompt_comparative`, compute XP, store verdict |
| `appeal_round(match_id, round)` | server | Supreme Validator tiebreaker, doubled stakes |
| `get_match(match_id)` | public | Read match data |
| `get_match_count()` | public | Total matches |
| `get_charges_pack()` | public | Current charges |
| `get_player_stats(addr)` | public | XP/wins/losses |
| `get_leaderboard(addrs_json)` | public | Batch stats sorted by XP |

**AI Jury:**
- Single `gl.nondet.exec_prompt()` simulating all 5 personas: Stern Judge, Drunk Poet, Conspiracy Theorist, Corporate HR, Literal Toddler
- `gl.eq_principle.prompt_comparative()` runs it on 3 validators independently
- Consensus on `final_verdict` and `appealed`; individual `reasoning` and `confidence` can differ
- Appeal triggers Supreme Validator persona with doubled stakes

---

## Communication Flow

```
[Web Browser]                    [Game Server]               [GenLayer Blockchain]
    │                                 │                              │
    │── c:create_room ───────────────▶│                              │
    │◀─ s:room_state ────────────────│                              │
    │── c:start_match ──────────────▶│                              │
    │                                 │── create_match() ──────────▶│
    │                                 │◀─ tx receipt ───────────────│
    │◀─ s:phase_change (CHARGE) ────│                              │
    │◀─ s:round_started ────────────│                              │
    │── c:submit_accusation ───────▶│                              │
    │── c:submit_defense ──────────▶│                              │
    │◀─ s:phase_change (JURY) ─────│                              │
    │                                 │── submit_round() ──────────▶│
    │                                 │        │                    │
    │                                 │        │── exec_prompt() ───│── 3 validators
    │                                 │        │◀─ verdict ─────────│
    │◀─ s:jury_bubble (×5) ─────────│                              │
    │◀─ s:verdict ──────────────────│                              │
    │◀─ s:match_end ────────────────│                              │
```

---

## Game Loop (State Machine)

```
LOBBY → CHARGE → ACCUSE → DEFEND → JURY → VERDICT
                    ↑                         │
                    │    (repeat 2 rounds)    │
                    └─────────────────────────┘
                                              │
                                        MATCH_END
```

| Phase | Duration | What Happens |
|---|---|---|
| **LOBBY** | Until start | Players join, bots added, wallet registration |
| **CHARGE** | 15s | Random charge revealed, random defendant selected |
| **ACCUSE** | 45s | Prosecutors submit accusations (text) |
| **DEFEND** | 30s | Defendant submits defense (text) |
| **JURY** | 30s | AI personas deliberate, verdict bubbles streamed one-by-one |
| **VERDICT** | 15s | Outcome revealed (GUILTY/NOT GUILTY), XP changes applied |
| **MATCH_END** | 30s | Final leaderboard, titles awarded, shareable cards |

---

## Bot Players

8 personalities with unique accusation/defense phrase pools across 5 style categories:

| Bot | Style |
|---|---|
| AgentChaos | aggressive |
| DramaLlama | dramatic |
| SirGoofington | silly |
| JudgeBot3000 | formal |
| TinfoilTed | paranoid |
| VibeCheck | dramatic |
| ColdLogic | formal |
| MayorMischief | silly |

---

## Key Ports (Local Dev)

| Port | Service | URL |
|---|---|---|
| 5173 | Frontend (Vite) | `http://localhost:5173` |
| 4100 | Game Server | `http://localhost:4100` |
| 4000 | GenLayer JSON-RPC | `http://localhost:4000/api` |
| 8080 | GenLayer Studio UI | `http://localhost:8080` |
| 3000 | GenLayer Dashboard | `http://localhost:3000/dashboard` |
| 3001 | GenLayer Explorer | `http://localhost:3001` |

---

## Data Storage

- **No traditional database.** All persistent state on GenLayer blockchain.
- **Server:** Ephemeral in-memory state (rooms, players, phases) — lost on restart.
- **Blockchain:** `TreeMap[Address, u256]` for XP/wins/losses. Matches stored as JSON strings.
- **Browser localStorage:** Auto-generated Ethereum keypair (`bc_private_key`), display name (`bc_display_name`).
- **File system:** `contract/content/charges.json` (100 hot takes, source of truth). A copy is embedded in `server/src/content/charges.json` so Railway deployments load charges without needing the contract directory mounted.

---

## Blockchain Integration

- **Platform:** GenLayer (Intelligent Contracts + Optimistic Democracy)
- **Network:** GenLayer Studionet
- **Contract address:** `0xC5dd84432bDBd6ee83166Af78Ec6DfdC5d4f0641`
- **Consensus:** `prompt_comparative` (3 validators, not strict equality — tolerates LLM output jitter)
- **Client SDK:** `genlayer-js` with patched `eth_gasPrice` (returns `"0x1"` fallback)

---

## Dev Workflow

```bash
pnpm install                          # Install all dependencies
# Start GenLayer Studio (Docker containers)
# Deploy contract via Studio UI (:8080)
# Copy .env.example → .env, fill in contract address
pnpm dev:server                       # Terminal 1: game server on :4100
pnpm dev:web                          # Terminal 2: frontend on :5173
```

**Root scripts:**
- `pnpm dev:server` — `tsx watch` (hot-reload game server)
- `pnpm dev:web` — Vite dev server
- `pnpm build` — Build all packages
- `pnpm typecheck` — Type-check all packages

---

## Deployment

- **Server:** Dockerfile (multi-stage `node:22-alpine`), exposes `:4100`. Target: Railway/Fly.io.
- **Frontend:** Built separately via `vite build`. Target: Vercel (static deploy).
- **Contract:** Deployed via GenLayer Studio UI at `:8080`.

---

## AI Jury Architecture

All AI runs on-chain via GenLayer's built-in LLM execution — no external AI services.

1. Server calls `submit_round()` on the contract with all round data
2. Contract builds a prompt asking the LLM to roleplay 5 personas judging the arguments
3. `gl.nondet.exec_prompt()` executes the prompt once (single call due to `eq_principle` limitation)
4. `gl.eq_principle.prompt_comparative()` runs it across 3 validators independently
5. Validators compare `final_verdict` and `appealed` fields for consensus
6. Contract computes XP deltas and stores verdict
7. Server reads the receipt and streams `jury_bubble` events to the frontend
8. On receipt parse failure, server falls back to `stubJury.ts` (offline random verdicts)

**Receipt parsing:** Studionet returns verdict JSON with missing commas between keys. A regex-based field extractor handles this transparently — all 5 persona verdicts and XP deltas are extracted correctly.

---

## Testing

No project-level test files exist yet. `contract/schemas/backstab_court_schema.py` provides a JSON-RPC schema for potential integration testing but no test runner is configured.
