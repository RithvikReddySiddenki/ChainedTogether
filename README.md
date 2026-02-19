# ChainedTogether 💘⛓️

> AI-powered matchmaking meets DAO governance. An on-chain dating app where matches require community approval.

**Built for hackathons. Ready in 3 days.**

---

## 🎯 What Is This?

ChainedTogether is a decentralized matchmaking platform that combines:
- **AI-powered matching** using adaptive conversational intake (via 0g Labs compute abstraction)
- **DAO-gated voting** where the community decides if matches are approved
- **Privacy-first design** where profile details are never shared until matches are approved
- **Off-chain chat** unlocked only after on-chain approval

### Core Flow
1. User connects wallet → uploads image → completes AI intake chat
2. AI agent asks 6-12 adaptive questions, extracts structured profile + embedding
3. User browses top matches (ranked by AI similarity)
4. User proposes match on-chain → DAO votes
5. If approved → chat unlocks, both users see each other's basic info

---

## 🏗️ Architecture

### Tech Stack
- **Smart Contracts**: Solidity 0.8.20 + Hardhat
- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Web3**: wagmi + viem + RainbowKit
- **Database**: Supabase (Postgres)
- **AI**: 0g compute client abstraction (MOCK mode for demo)

### Key Contracts
- `MatchRegistry.sol`: Manages proposals, voting, and finalization
- `DemoDAOToken.sol`: Simple ERC20 for token-gated voting

### AI Service Abstraction
- All AI logic is behind `services/0gComputeClient.ts`
- **MOCK mode** (default): Deterministic Q&A + cosine similarity
- **Production mode**: Uncomment HTTP calls to 0g compute endpoint

### On-Chain Logic
- **Proposal**: User A proposes match with User B
- **Voting**: Token holders vote yes/no
- **Early close**: Closes immediately if yes/no votes hit threshold
- **Finalize**: Anyone can finalize after deadline

---

## 📦 Setup

### Prerequisites
- Node.js 18+
- Hardhat
- Supabase account
- WalletConnect Project ID (optional, for production)

### 1. Clone & Install
```bash
git clone <repo-url>
cd ChainedTogether
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Contracts (fill after deployment)
NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_DAO_TOKEN_ADDRESS=0x...

# WalletConnect
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id

# Deployment
PRIVATE_KEY=your-private-key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
```

### 3. Setup Supabase
1. Create new Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Run `supabase/seed.sql` to populate demo profiles
4. (Optional) Disable RLS for demo: `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;`

### 4. Deploy Contracts
Start local Hardhat node:
```bash
npm run node
```

In another terminal, deploy:
```bash
npm run deploy
```

Copy the output contract addresses to `.env`:
```
NEXT_PUBLIC_DAO_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS=0x...
```

### 5. Run Frontend
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🎮 Demo Flow

### Setup Demo Wallets
You'll need 3-5 wallets with DAO tokens to simulate voting:
1. Import test accounts from Hardhat node (check console output)
2. The deploy script mints 100 tokens to the deployer
3. Add more voter addresses in `scripts/deploy.ts` and redeploy

### Testing the Flow
1. **Connect wallet** (use deployer address initially)
2. **Create profile**:
   - Go to `/profile`
   - Upload image (use placeholder URLs like `https://i.pravatar.cc/300?img=1`)
   - Click "Start AI Intake"
   - Answer 6-8 questions from the AI agent
   - Confirm summary
3. **Browse matches**:
   - Go to `/matches`
   - See top-ranked profiles (from seed data)
   - Click "Propose Match" on one
4. **Vote on proposals**:
   - Go to `/proposals`
   - See your proposal as OPEN
   - Switch to voter wallet (with DAO tokens)
   - Vote Yes/No
   - Watch for early close when threshold is hit
5. **Chat** (if approved):
   - Go to `/chat/[matchId]`
   - Only accessible if match is APPROVED and you're a participant

---

## 📁 Project Structure

```
ChainedTogether/
├── contracts/              # Solidity smart contracts
│   ├── MatchRegistry.sol
│   └── DemoDAOToken.sol
├── scripts/                # Deployment scripts
│   └── deploy.ts
├── src/
│   ├── app/               # Next.js pages (App Router)
│   │   ├── page.tsx      # Landing
│   │   ├── profile/
│   │   ├── matches/
│   │   ├── proposals/
│   │   └── chat/[matchId]/
│   ├── components/
│   │   ├── ui/           # Base UI components
│   │   ├── IntakeChat.tsx
│   │   ├── MatchCard.tsx
│   │   └── ProposalCard.tsx
│   ├── lib/
│   │   ├── wagmi.ts      # Web3 config
│   │   ├── supabase.ts
│   │   └── contracts.ts  # ABIs + addresses
│   ├── services/
│   │   └── 0gComputeClient.ts  # AI abstraction
│   ├── styles/
│   │   ├── tokens.ts     # Design tokens
│   │   └── globals.css
│   └── types/
│       └── index.ts
├── supabase/
│   ├── schema.sql
│   └── seed.sql
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## 🎨 Restyling the UI

All styling is intentionally minimal and easy to change:

1. **Design tokens**: Edit `src/styles/tokens.ts` (spacing, radius, fonts)
2. **Colors**: Edit CSS variables in `src/styles/globals.css`
3. **Components**: All UI components are in `src/components/ui/`

Example: Change accent color from blue to purple
```css
/* src/styles/globals.css */
:root {
  --accent: 280 90% 56%;  /* Purple in HSL */
}
```

---

## 🚀 Production Deployment

### 1. Deploy to Testnet (Sepolia)
```bash
npm run deploy:sepolia
```

### 2. Connect Real 0g Compute
Uncomment HTTP calls in `src/services/0gComputeClient.ts` and add:
```env
NEXT_PUBLIC_0G_ENDPOINT=https://api.0g.com
NEXT_PUBLIC_0G_API_KEY=your-api-key
```

### 3. Deploy Frontend
Deploy to Vercel/Netlify:
```bash
npm run build
```

Add environment variables in hosting platform dashboard.

### 4. Enable Supabase RLS
Re-enable row-level security for production:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- etc for other tables
```

---

## 📋 3-Day Implementation Checklist

See `IMPLEMENTATION.md` for detailed day-by-day tasks.

### Day 1: Contracts + DB
- [ ] Deploy contracts to localhost
- [ ] Setup Supabase schema
- [ ] Test contract functions (propose, vote, finalize)

### Day 2: Frontend Core
- [ ] Setup Next.js + wagmi + RainbowKit
- [ ] Build profile creation + AI intake chat
- [ ] Build match browsing + proposal flow

### Day 3: Integration + Polish
- [ ] Connect voting UI to contracts
- [ ] Build chat with on-chain gating
- [ ] Test end-to-end flow
- [ ] Deploy contracts to testnet
- [ ] Record demo video

---

## 🔐 Security Notes

**This is a hackathon MVP. NOT production-ready.**

Known limitations:
- No ZK proofs (profile data visible in Supabase)
- No encryption (chat messages are plaintext)
- Minimal input validation
- RLS policies are permissive (chat gating via API route, not RLS)
- No rate limiting
- No spam prevention

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- **0g Labs** for compute abstraction layer
- **Nouns Builder** for DAO token inspiration
- **Supabase** for off-chain DB
- **RainbowKit** for wallet UX

---

## 💬 Support

For issues or questions:
1. Check `IMPLEMENTATION.md` for detailed setup steps
2. Review contracts in `contracts/` for on-chain logic
3. Review `src/services/0gComputeClient.ts` for AI logic

---

Built with ❤️ for hackathons.
