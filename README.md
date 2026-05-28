# Backstab Court

> A multiplayer AI-judged courtroom party game on GenLayer.
> Accuse your friends of absurd hot takes. An unhinged AI jury of 5 personas delivers live verdicts on-chain. Betray, defend, win XP.

Built for GenLayer's community mini-game mission. Showcases **Intelligent Contracts** and **Optimistic Democracy** consensus as the core game mechanic — the AI jury runs entirely on-chain via `gl.nondet.exec_prompt` and `gl.eq_principle.prompt_comparative`.

## Live Demo

- **Frontend:** https://backstab-court-web.vercel.app/
- **Contract:** `0xC5dd84432bDBd6ee83166Af78Ec6DfdC5d4f0641` on GenLayer Studionet

## How it works

1. Players join a room and pick a hot take to debate
2. Prosecutors accuse, the defendant defends
3. The GenLayer contract runs 5 AI personas (Stern Judge, Drunk Poet, Conspiracy Theorist, Corporate HR, Literal Toddler) as an on-chain jury
4. Optimistic Democracy consensus finalizes the verdict — GUILTY, INNOCENT, or CHAOTIC
5. XP is staked and transferred on-chain based on the outcome
6. If the jury is split, players can appeal — triggering the Supreme Validator with doubled stakes

## Repo layout

```
contract/   GenLayer Intelligent Contract (Python) + deploy scripts
server/     Node game server (TypeScript + Socket.IO) hosted on Railway
web/        Vite + React frontend hosted on Vercel
shared/     Types + constants shared by server and web
```

## Quick start (local dev)

```powershell
# 1. Install dependencies
pnpm install

# 2. Copy env and fill in values
cp .env.example .env

# 3. Deploy the contract to Studionet
server/node_modules/.bin/tsx.CMD contract/deploy/deploy.ts

# 4. Run the stack
pnpm dev:server     # game server on :4100
pnpm dev:web        # frontend on :5173
```

## Tech stack

| Layer | Tech |
|---|---|
| Intelligent Contract | Python (GenVM), `gl.nondet.exec_prompt`, `gl.eq_principle.prompt_comparative` |
| Game Server | Node.js + TypeScript + Socket.IO, hosted on Railway |
| Frontend | Vite + React 18 + TypeScript, hosted on Vercel |
| Blockchain SDK | `genlayer-js` v1.1.8 |
| Network | GenLayer Studionet |
