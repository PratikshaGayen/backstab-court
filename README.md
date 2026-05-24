# 🔪 Backstab Court

> A 10-minute AI-judged courtroom party game on GenLayer.
> Accuse your friends of absurd crimes. An unhinged AI jury delivers live verdicts. Betray, defend, win XP.

Built for GenLayer's community mini-game mission. Showcases **Intelligent Contracts** + **Optimistic Democracy** consensus as the core game mechanic.

See [BLUEPRINT.md](./BLUEPRINT.md) for the full design and roadmap.

## Repo layout

```
contract/   GenLayer Intelligent Contract (Python)
server/     Node game server (TypeScript + Socket.IO)
web/        Vite + React frontend
shared/     Types + constants shared by server and web
```

## Quick start

```powershell
# 1. Install Node deps across the workspace
pnpm install

# 2. Copy env
cp .env.example .env
# Fill in CONTRACT_ADDRESS after deploying the contract

# 3. Start GenLayer Studio (localnet) in a separate terminal
# See genlayer-studio docs: https://github.com/genlayerlabs/genlayer-studio

# 4. Deploy the contract (Studio UI at http://localhost:8080, paste contract/backstab_court.py)

# 5. Run the stack
pnpm dev:server     # :4100
pnpm dev:web        # :5173
```

## Status

**Phase 0 — Skeleton** (in progress)

See roadmap in [BLUEPRINT.md §7](./BLUEPRINT.md#7-build-roadmap).
