# ChainedTogether

A decentralized matchmaking platform where AI proposes matches and the community votes to approve them on-chain.

## How It Works

1. **Connect wallet** and create a profile through an AI-driven intake chat
2. **AI generates match pairs** using 0G Compute (Qwen 2.5 7B) based on compatibility scoring
3. **DAO votes** on proposed matches -- community members swipe to approve or reject
4. **Matches approved** at 5+ yes votes unlock a conversation between the matched pair
5. **Both users accept** the match to open direct messaging

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, Framer Motion, Three.js
- **Web3**: wagmi, viem, RainbowKit
- **AI**: 0G Compute (OpenAI-compatible inference via `@0glabs/0g-serving-broker`)
- **Smart Contracts**: Solidity 0.8.20 (MatchRegistry + DemoDAOToken)
- **Database**: Supabase (PostgreSQL)
- **Voting**: On-chain (MatchRegistry) + optional Snapshot gasless voting

## Setup

```bash
npm install
cp .env.example .env  # fill in values
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_0G_ENDPOINT` | 0G inference endpoint |
| `OG_PROVIDER_ADDRESS` | 0G provider wallet address |
| `PRIVATE_KEY` | Deployer wallet private key |

### Database

Run the migrations in order in Supabase SQL Editor:

```
supabase/schema.sql
supabase/migrations/001_complete_schema.sql
supabase/migrations/002_add_accept_decline.sql
supabase/migrations/003_add_bio_column.sql
```

### Smart Contracts

```bash
npm run node        # start local Hardhat node
npm run deploy      # deploy contracts (copies addresses to .env)
```

### Run

```bash
npm run dev         # start Next.js dev server
npm run jobs        # start background lifecycle jobs (match generation, voting, expiration)
```

## Project Structure

```
contracts/           Solidity contracts (MatchRegistry, DemoDAOToken)
scripts/             Deployment, seeding, and utility scripts
src/
  app/               Next.js pages (landing, profile, vote)
  components/        React components (VotingCard, GlobeCanvas, IntakeChat)
  services/          AI inference, matchmaking, DAO clients, lifecycle jobs
supabase/            Schema, migrations, seed data
```

## Architecture

**Match Lifecycle**: `proposed` -> `voting` -> `approved`/`rejected` -> conversation created -> both accept -> chat unlocks

**AI Layer**: All inference goes through 0G Compute with automatic fallback to deterministic heuristics if the service is unavailable.

**Background Jobs**: Match generator (5min), proposal creator (1min), expiration handler (1min), queue cleanup (24hr).

## License

MIT
