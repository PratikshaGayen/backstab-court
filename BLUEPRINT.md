# 🔪 Backstab Court — Project Blueprint

> A 10-minute multiplayer courtroom game where players accuse each other of absurd crimes and an AI jury of conflicting personas delivers live, streamed verdicts.  
> Built on **GenLayer Intelligent Contracts** to showcase **Optimistic Democracy** consensus as the core game mechanic.

---

## 1. Vision

Backstab Court turns GenLayer's consensus protocol into a party game. Players experience — not read about — why subjective truth needs multiple validators and appeal paths. Every verdict is a live demo of Optimistic Democracy.

**Tagline:** *"The AI is the judge. The jury is unhinged. Your friends are the witnesses."*

---

## 2. Core Pillars

| Pillar | Implementation |
|---|---|
| Fast onboarding | One-sentence rule: *accuse, defend, AI decides* |
| Social conflict | Must name a real player every round |
| Surprising AI | 5 validators with loud, conflicting personas |
| Spectator fun | Jury deliberation streams live to the whole room |
| Public leaderboard + ego | Live XP bars, weekly global board, earned titles |
| Betrayal / risk | Finger-pointing + final Double XP round |

---

## 3. Gameplay Spec

### Match structure
- **Players per room:** 4–6
- **Rounds per match:** 4 (final is Double XP)
- **Total duration:** 8–12 minutes

### Round phases

| Phase | Duration | What happens |
|---|---|---|
| Charge | 10s | Each player dealt a random absurd accusation, visible to the room |
| Point the Finger | 20s | Player names another player as the true culprit + 1 sentence |
| Defense | 30s | Accused writes a 1-sentence defense (plea, counter-accuse, chaos) |
| Jury Deliberation | 40s | 5 LLM validators stream reasoning live; may trigger Appeal |
| Verdict + XP | 10s | Majority rules, XP transferred, leaderboard updates |

### XP mechanics
- Guilty verdict → accused loses XP stake → accuser gains it
- Innocent verdict → accuser loses XP stake → accused gains it
- Chaotic Neutral verdict → XP goes to the validator-chosen "MVP argument"
- Appeal triggered → all stakes double
- Final round → all stakes already doubled

### Validator personas (v1)
1. **Stern Judge** — by-the-book, formal, hates chaos
2. **Drunk Poet** — metaphor-drunk, emotional, sides with underdogs
3. **Conspiracy Theorist** — sees hidden motives everywhere
4. **Corporate HR** — focuses on policy, tone, professionalism
5. **Literal Toddler** — reasons at face value, easily distracted

Each validator is an independent LLM call with its own system prompt. Disagreement beyond threshold → **Supreme Validator** (6th call) breaks the tie.

### Earned titles (end of match)
- **Most Betrayed** — accused most times
- **Jury's Darling** — highest innocent-verdict rate
- **Chaos Agent** — most appeals triggered
- **Silver Tongue** — best defense win rate

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  Lobby · Room · Courtroom UI · Live Jury Stream      │
└───────────────┬──────────────────────────────────────┘
                │ WebSocket (room state)
                │ HTTP (actions)
┌───────────────▼──────────────────────────────────────┐
│                  Game Server (Node)                  │
│  Room manager · Timers · Phase state machine         │
│  Bridges player actions ↔ Intelligent Contract       │
└───────────────┬──────────────────────────────────────┘
                │ RPC
┌───────────────▼──────────────────────────────────────┐
│         GenLayer Intelligent Contract (Python)       │
│  - Match state                                       │
│  - Charge dealing                                    │
│  - Accusation / defense storage                      │
│  - Parallel validator calls (5 personas)             │
│  - Consensus / appeal logic                          │
│  - XP transfers + leaderboard                        │
└──────────────────────────────────────────────────────┘
```

### Why this split
- **Contract** owns everything adversarial: verdicts, XP, leaderboard. Non-negotiable trust.
- **Game server** owns presentation: timers, room sockets, UI sync. Fast, non-adversarial.
- **Frontend** is pure view + input.

---

## 5. Project Structure

```
Genlayer-Game/
├── BLUEPRINT.md                  ← this file
├── README.md
├── .env.example
├── .gitattributes                ← *.sh text eol=lf (Windows safety)
├── .gitignore
├── package.json                  ← pnpm workspace root
├── pnpm-workspace.yaml
│
├── contract/                     ← GenLayer Intelligent Contract
│   ├── backstab_court.py         ← main contract
│   ├── content/
│   │   ├── charges.json          ← weekly rotating charge pack
│   │   └── charge_generator.py   ← LLM batch generator
│   ├── schemas/
│   │   └── backstab_court_schema.py
│   └── tests/
│       └── test_backstab_court.py
│
├── server/                       ← Node game server (TypeScript)
│   ├── src/
│   │   ├── index.ts
│   │   ├── rooms/
│   │   │   ├── RoomManager.ts
│   │   │   ├── Room.ts
│   │   │   └── PhaseMachine.ts
│   │   ├── contract/
│   │   │   └── client.ts         ← genlayer-js server-side wrapper
│   │   ├── sockets/
│   │   │   └── gateway.ts
│   │   └── types.ts
│   ├── tsconfig.json
│   └── package.json
│
├── web/                          ← Vite + React frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx
│   │   │   ├── Lobby.tsx
│   │   │   └── Courtroom.tsx
│   │   ├── components/
│   │   │   ├── ChargeCard.tsx
│   │   │   ├── AccusationInput.tsx
│   │   │   ├── DefenseInput.tsx
│   │   │   ├── JuryStream.tsx
│   │   │   ├── VerdictBanner.tsx
│   │   │   ├── XPBar.tsx
│   │   │   └── Leaderboard.tsx
│   │   ├── hooks/
│   │   │   ├── useGenLayer.ts    ← with eth_gasPrice patch
│   │   │   └── useSocket.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       └── socket.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── shared/                       ← types + constants shared by server & web
    ├── src/
    │   ├── phases.ts
    │   ├── events.ts
    │   └── types.ts
    ├── tsconfig.json
    └── package.json
```

---

## 6. Data Model (contract-level)

```python
Match {
  id: str
  players: list[PlayerId]
  round: int                      # 1..4
  phase: Phase                    # CHARGE | ACCUSE | DEFEND | JURY | VERDICT
  current_charges: dict[PlayerId, Charge]
  accusations: dict[PlayerId, Accusation]
  defenses: dict[PlayerId, Defense]
  jury_scores: list[ValidatorScore]
  verdict: Verdict | None
  xp: dict[PlayerId, int]
  history: list[RoundSummary]
}

Accusation { accuser, target, text, timestamp }
Defense    { defendant, text, timestamp }
ValidatorScore { validator_id, verdict, reasoning, confidence }
Verdict    { outcome: GUILTY|INNOCENT|CHAOTIC, appealed: bool, xp_delta: dict }
```

---

## 7. Build Roadmap

### Phase 0 — Skeleton (Day 1)
- [x] Monorepo scaffold (contract / server / web / shared)
- [x] Contract skeleton with storage + stub round submission
- [x] Vite + React landing + lobby + courtroom routes
- [x] Node + Socket.IO server with room manager
- [x] Shared types package for phases, events, and state

### Phase 1 — Core loop, no AI (Day 2–3)
- [x] Room lobby: create, join by code, 4–6 players
- [x] Phase state machine on server (CHARGE→ACCUSE→DEFEND→JURY→VERDICT loop)
- [x] Charge dealing from rotating pack
- [x] Accusation + defense collection with early-advance on full submission
- [x] Stub jury (5 personas, random verdicts, XP math, appeal detection)
- [x] Full courtroom UI: ChargeCard, AccusationInput, DefenseInput, JuryStream, VerdictBanner, Leaderboard
- [x] Match end with leaderboard + room reset to lobby
- [x] End-to-end smoke test (4 players, 4 rounds, match completes)

### Phase 2 — The Jury (Day 4–5)
- [x] 5 validator persona prompt template (single LLM call simulating all 5)
- [x] prompt_comparative jury call inside contract with explicit criteria
- [x] Consensus rule: majority verdict; split → appealed flag
- [x] appeal_round method with Supreme Validator persona
- [x] XP calculation on-chain (GUILTY/INNOCENT/CHAOTIC + appeal doubling)
- [x] Persistent XP/wins/losses in TreeMap[Address, u256]
- [x] get_leaderboard view method for batch stats
- [x] Server contract client: submit_round + appeal_round + readContract
- [x] Room.runJuryAsync() calls contract when configured, falls back to stub
- [x] Wallet registration flow (socket → server → contract address mapping)
- [x] JuryStream UI updated with "waiting for AI" indicator
- [x] Full typecheck + smoke test passing

### Phase 3 — Stakes & leaderboard (Day 6)
- [x] XP transfers on verdict (already in Phase 2 contract + server)
- [x] Double XP final round with visual "⚡ FINAL ROUND — DOUBLE XP" badge
- [x] Match-end titles: Most Betrayed, Jury's Darling, Chaos Agent, Silver Tongue, Scapegoat
- [x] Title computation in shared package (reusable server + client)
- [x] Enhanced MatchEnd panel with medals, XP breakdown, title cards
- [x] Global leaderboard page (/leaderboard) reading on-chain stats
- [x] Leaderboard link on landing page
- [x] Full typecheck + smoke test with titles passing

### Phase 4 — Polish & replay (Day 7)
- [x] Charge pack rotation: 50 charges, weekly subset of 15 via seeded shuffle
- [x] No-repeat charges within a single match
- [x] Spectator mode: join as viewer, see everything, can't submit
- [x] Spectate button in lobby + spectator badge in courtroom header
- [x] Shareable verdict cards: canvas-rendered PNG export with verdict, personas, charge
- [x] "Share verdict card" button after each verdict
- [x] Full typecheck passing

### Phase 5 — Community & distribution
- [ ] Discord bot wrapper (start match from a Discord channel)
- [ ] Match replay viewer
- [ ] Analytics: most divisive charges, most active validators

---

## 8. Locked Decisions (from Predikt experience)

| Decision | Choice | Reason |
|---|---|---|
| Contract language | **Python** (GenVM) | Only option, already proven in Predikt |
| Contract SDK pin | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` | Same as Predikt v0.2.16 |
| Frontend | **Vite + React** | Matches Predikt stack, already debugged gas-price patch |
| Frontend SDK | `genlayer-js@^1.1.8` with `eth_gasPrice` patch | Known working |
| Game server | **Node + TypeScript + Socket.IO** | WebSockets for room sync; contract owns truth |
| Monorepo | **pnpm workspaces** | Simple, no extra tooling |
| Consensus EP | `prompt_comparative` with explicit criteria | `strict_eq` will fail on LLM jitter |
| Storage shape | JSON strings in `str` fields + `TreeMap[Address, u256]` for XP | `list`/`dict`/`Optional`/`float` break at deploy |
| Identity | Anonymous on v1 (auto-generated keypair stored in localStorage) | Zero onboarding friction, matches Predikt pattern |
| Validators config | `amount: 3` per match verdict | amount≥2 required for consensus, 3 = sweet spot |
| Networks | localnet → studionet → bradbury | Same path as Predikt |

## 9. Still to Decide (not blocking)

- Charge content moderation: pre-filtered pack vs live LLM guardrail?
- Supreme Validator: fixed persona or randomized per match?
- XP persistence: on-chain forever vs weekly reset?

---

## 10. Success Criteria

- A 6-player match completes in under 12 minutes end to end
- Validators disagree (trigger appeal) in at least 1 of 4 rounds on average
- A first-time player understands the rules within 30 seconds of joining
- Spectators stay through full matches (watch-time ≥ 80% of match length)
- Weekly return rate ≥ 40% once charge packs rotate

---

## 11. Consensus strategy (learned from Predikt)

The jury phase is the only expensive part. One `prompt_comparative` call per verdict, no more.

**Closure pattern** — each round stores accusation + defense on-chain, then a single nondet block asks the leader's model to simulate *all 5 personas in one prompt* and emit a structured JSON verdict. Comparator criteria:

```
"The field 'verdict' must have the same value across all answers
(GUILTY, INNOCENT, or CHAOTIC). The field 'appeal_triggered' must
match. Ignore per-validator 'reasoning' strings (subjective prose).
Ignore 'confidence' numeric values (jitter expected)."
```

Why simulate 5 personas in one prompt instead of 5 separate `exec_prompt` calls:
- `eq_principle.*` can only be called once per method (Predikt rule)
- Five personas in one prompt keeps the contract simple and cheap
- The real GenLayer consensus still happens across the 3 validators running this whole method, so Optimistic Democracy is preserved at the *protocol* level while the *game narrative* shows five personas

**Appeal logic** lives in deterministic postamble: if returned persona verdicts split beyond threshold, call a *second* method `appeal_verdict(round_id)` that runs a fresh `prompt_comparative` with the Supreme Validator persona. Two transactions, cleanly separated.

---

## 12. Known pitfalls baked into the plan

From the Predikt reference:

- ❌ `list[X]` / `dict` / `float` / `Optional` as contract fields → use JSON strings
- ❌ `strict_eq` on LLM outputs → always `prompt_comparative` with explicit ignore list
- ❌ One validator in config → always `amount: 3`
- ❌ `datetime.now()` for sub-second comparisons → only for minute+ deadlines
- ❌ Pass `account` to `writeContract` → client already has it
- ❌ Pass `value: 0n` to `writeContract` → triggers BigInt(undefined)
- ✅ Patch `eth_gasPrice` in genlayer-js client (1.1.8 bug)
- ✅ Rebind `self.foo` to locals before closure; closures can't capture self
- ✅ Strip ```` ```json ```` markdown from LLM output before `json.loads`
- ✅ `.gitattributes` with `*.sh text eol=lf` for Windows CRLF safety

---

## 13. Next Step

Scaffold **Phase 0**: pnpm monorepo, empty GenLayer contract with header + storage, empty Vite+React web app, empty Node+Socket.IO server, shared TS types package.
