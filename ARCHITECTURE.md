# Backstab Court — Architecture

A simple explanation of how all the pieces fit together.

---

## The three layers

```
┌─────────────────────────────────────────────┐
│              FRONTEND (React)               │
│         What players see and click          │
└──────────────────┬──────────────────────────┘
                   │ WebSocket (real-time)
                   │ 
┌──────────────────▼──────────────────────────┐
│            GAME SERVER (Node.js)            │
│     Rooms, timers, bots, phase logic        │
└──────────────────┬──────────────────────────┘
                   │ RPC call
                   │
┌──────────────────▼──────────────────────────┐
│       GENLAYER CONTRACT (Python)            │
│   AI jury, XP storage, on-chain verdicts    │
└─────────────────────────────────────────────┘
```

**Frontend** = the UI. Shows the game, collects player input.  
**Game Server** = the brain. Manages rooms, runs timers, coordinates everything.  
**Contract** = the judge. Calls the LLM, reaches consensus, stores XP permanently.

---

## Current status (what works, what doesn't)

| Feature | Status | Notes |
|---------|--------|-------|
| Room create/join/leave | Working | 6-letter codes, auto-rejoin on navigation |
| Bot players | Working | Fill with bots button, 5 personality styles |
| Phase state machine | Working | CHARGE->ACCUSE->DEFEND->JURY->VERDICT loop |
| Hot take debates | Working | 50 curated topics, weekly rotation |
| Spectator mode | Working | Watch without playing |
| Stub jury (random) | Working | Fallback when contract fails |
| Contract deployment | Working | Deployed at 0x8D1dBB87... on localnet |
| Contract jury call | Partially working | Contract IS called, but receipt parsing fails |
| Real AI verdicts | NOT WORKING YET | Receipt returns undefined - being debugged |
| On-chain XP | Not active | Depends on contract jury working |
| Shareable verdict cards | Working | PNG export |
| Match-end titles | Working | Computed from match history |
| Global leaderboard | UI exists | Needs working contract to show real data |

### The current blocker

The server calls the GenLayer contract successfully. The LLM runs. Validators reach consensus. But when the receipt comes back, the verdict data is in an unexpected field. The server can't find it, gets `undefined`, and falls back to the random stub jury.

**Debug logging has been added** to `server/src/contract/client.ts` to identify the exact receipt structure. Next step is to play a match, read the logs, and fix the field path.

---

## How a round flows through the system

```
Player writes argument
        │
        ▼
[Frontend] sends text via WebSocket ──► [Game Server] collects it
                                              │
                                    (waits for all players or timer expires)
                                              │
                                              ▼
                                    [Game Server] bundles all arguments
                                              │
                                              ▼
                                    [Contract] receives the bundle via RPC
                                              │
                                              ▼
                                    [Contract] builds prompt with 5 personas
                                    and sends to LLM via gl.nondet.exec_prompt()
                                              │
                                              ▼
                                    [GenLayer validators] each run the
                                    prompt independently (3 validators)
                                              │
                                              ▼
                                    [prompt_comparative] checks validators
                                    agree on final_verdict + appealed fields
                                              │
                                              ▼
                                    [Contract] stores verdict + updates XP
                                              │
                                              ▼
                                    [Game Server] receives verdict from receipt
                                              │
                                              ▼
                                    [Game Server] streams persona bubbles
                                    to all players one by one
                                              │
                                              ▼
                                    [Frontend] shows verdict + XP changes
```

**Current failure point:** Step "Game Server receives verdict from receipt" - the receipt structure doesn't match what the code expects.

---

## What each piece does

### Frontend (`web/`)

- **Landing page** — name input, how-to-play steps, game explanation
- **Lobby** — create/join rooms, add bots, spectate option
- **Courtroom** — the game itself. Phase-driven UI:
  - LOBBY: room code display, player dots, "Fill with bots" button
  - CHARGE: displays the hot take + who's defending
  - ACCUSE: text input for prosecutors ("argue why this is WRONG")
  - DEFEND: text input for defendant ("argue why this is RIGHT")
  - JURY: animated persona bubbles appearing one by one
  - VERDICT: result banner with XP changes + share button
  - MATCH_END: leaderboard with medals + earned titles
- **Global Leaderboard** — reads on-chain XP stats

### Game Server (`server/`)

- **RoomManager** — creates rooms, tracks them by 6-letter ID
- **Room** — the core class. Owns:
  - Player list (humans + bots)
  - Phase state machine with timers
  - Bot auto-play (staggered submissions with personality)
  - Jury execution (tries contract, falls back to stub)
  - Wallet mapping (socket IDs -> synthetic Ethereum addresses)
  - Match creation on contract (async, non-blocking)
- **PhaseMachine** — pure state transitions
- **Gateway** — Socket.IO event handlers
- **StubJury** — offline fallback (random verdicts with canned persona lines)
- **BotPlayer** — 8 bot personalities, debate-style arguments for/against hot takes
- **Charges** — weekly rotation via seeded shuffle, no repeats per match
- **Contract client** — genlayer-js wrapper with receipt parsing (currently being debugged)

### GenLayer Contract (`contract/backstab_court.py`)

- **Storage:**
  - `matches_json` — all match data as JSON string
  - `xp_total` / `wins` / `losses` — per-address stats in TreeMaps
  - `charges_pack_json` — hot take pool

- **Key methods:**
  - `create_match(player_addresses_json)` — registers a match with player addresses
  - `submit_round(match_id, round_number, charge_text, defendant_address, accusations_json, defense_text)` — runs the AI jury
  - `appeal_round(match_id, round_number)` — Supreme Validator tiebreaker
  - `get_player_stats(address)` — read XP/wins/losses
  - `get_leaderboard(addresses_json)` — batch stats query

- **How the AI jury works inside the contract:**
  1. All arguments formatted into a single prompt
  2. Prompt asks LLM to roleplay 5 personas judging ARGUMENT QUALITY
  3. `gl.eq_principle.prompt_comparative()` runs on 3 validators independently
  4. Criteria: "final_verdict and appealed must match; ignore reasoning differences"
  5. If validators agree -> verdict stored on-chain
  6. If they disagree -> transaction fails, retries

- **The jury prompt judges:**
  - Stern Judge: logic and evidence
  - Drunk Poet: emotion and creativity
  - Conspiracy Theorist: originality and hidden angles
  - Corporate HR: clarity and professionalism
  - Literal Toddler: simplicity and gut feeling

---

## Communication

| From -> To | Method | What's sent |
|-----------|--------|-------------|
| Frontend -> Server | WebSocket events | Player actions (join, submit text, start match, add bots) |
| Server -> Frontend | WebSocket events | Room state, phase changes, jury bubbles, verdicts |
| Server -> Contract | genlayer-js RPC (`writeContract`) | `create_match`, `submit_round`, `appeal_round` |
| Contract -> Server | RPC receipt | Verdict JSON (outcome, personas, XP deltas) |
| Server -> Contract | genlayer-js RPC (`readContract`) | `get_player_stats`, `get_leaderboard` |

---

## The fallback system

```
Is CONTRACT_ADDRESS set in .env?
    │
    ├── NO ──► Use stub jury (random verdicts, instant)
    │
    └── YES ──► Did create_match succeed? (matchId != null)
                    │
                    ├── NO ──► Use stub jury
                    │
                    └── YES ──► Call submit_round on contract
                                    │
                                    ├── Success + valid verdict ──► Use real AI verdict
                                    │
                                    ├── Success but undefined verdict ──► Fall back to stub (CURRENT BUG)
                                    │
                                    └── Timeout (4 min) ──► Force stub verdict
```

---

## Bot system

Bots are server-side fake players. They:
- Get added to the room's player list with a `bot_` prefixed ID
- Have synthetic Ethereum addresses (keccak256 hash of room+id)
- Auto-submit arguments during ACCUSE phase (1-4 second random delay)
- Auto-submit defense during DEFEND phase (if they're the defendant)
- Have one of 5 personality styles: aggressive, dramatic, silly, formal, paranoid
- Use pre-written debate-style arguments (not random nonsense)

Bot names: AgentChaos, DramaLlama, SirGoofington, JudgeBot3000, TinfoilTed, VibeCheck, ColdLogic, MayorMischief

---

## Data ownership

| Data | Where it lives | Persistence |
|------|----------------|-------------|
| Room state (players, phase, round) | Server memory | Lost on server restart |
| Player arguments | Server memory during match | Not persisted after match |
| Verdicts + XP | GenLayer blockchain | Permanent (when contract jury works) |
| Hot take pool | `charges.json` + contract storage | File-based, rotates weekly |
| Player identity | Browser localStorage | Auto-generated keypair, no signup |
| Bot state | Server memory | Created fresh each match |

---

## Key files to know

| File | What it does |
|------|-------------|
| `server/src/rooms/Room.ts` | Core game logic - phases, bots, jury calls |
| `server/src/contract/client.ts` | GenLayer RPC wrapper - where the receipt bug is |
| `server/src/jury/stubJury.ts` | Random fallback jury |
| `server/src/bots/BotPlayer.ts` | Bot personalities and argument pools |
| `server/src/content/charges.ts` | Weekly charge rotation logic |
| `contract/backstab_court.py` | The on-chain AI jury |
| `web/src/pages/Courtroom.tsx` | Main game UI |
| `shared/src/phases.ts` | Phase durations (ACCUSE=40s, DEFEND=30s, etc.) |

---

## Ports (local development)

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Game Server | 4100 | http://localhost:4100 |
| GenLayer RPC | 4000 | http://localhost:4000/api |
| GenLayer Studio UI | 8080 | http://localhost:8080 |
| GenLayer Explorer | 3001 | http://localhost:3001 |

---

## What needs to happen next

1. **Fix receipt parsing** — play a match with debug logs, see what field the verdict is actually in, update the extraction path
2. **Once real AI works** — remove debug logs, test that verdicts reference actual player arguments
3. **Deploy to public** — host server (Railway/Fly.io), frontend (Vercel), contract on Studionet
